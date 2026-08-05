import test from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import {
  coupleDepuisUrl, sitesDistincts, compterCouples, blocsDuPrefixe, locatairesWorkday,
} from "./crawl.mjs";

const ligneCdx = (url) => `com,myworkdayjobs,x)/y 20260714032627 ${JSON.stringify({ url, mime: "text/html" })}`;

test("coupleDepuisUrl : lit locataire, instance et site", () => {
  assert.deepEqual(
    coupleDepuisUrl("https://sanofi.wd3.myworkdayjobs.com/SanofiCareers/job/Paris/X_R1"),
    { locataire: "sanofi", wd: "wd3", site: "SanofiCareers" },
  );
});

test("coupleDepuisUrl : saute le segment de langue", () => {
  assert.equal(
    coupleDepuisUrl("https://ercot.wd1.myworkdayjobs.com/en-US/ercot_careers/job/Austin/X").site,
    "ercot_careers",
  );
});

test("coupleDepuisUrl : écarte robots.txt et la racine", () => {
  assert.equal(coupleDepuisUrl("https://envista.wd1.myworkdayjobs.com/robots.txt"), null);
  assert.equal(coupleDepuisUrl("https://envista.wd1.myworkdayjobs.com/"), null);
});

test("coupleDepuisUrl : ignore ce qui n'est pas Workday", () => {
  assert.equal(coupleDepuisUrl("https://boards.greenhouse.io/onrunning"), null);
  assert.equal(coupleDepuisUrl(""), null);
});

test("coupleDepuisUrl : coupe la requête et l'ancre", () => {
  assert.equal(
    coupleDepuisUrl("https://x.wd1.myworkdayjobs.com/Careers/job/A?mode=job&iis=Indeed").site,
    "Careers",
  );
});

test("coupleDepuisUrl : le locataire est ramené en minuscules, pas le site", () => {
  const c = coupleDepuisUrl("https://GEA.wd3.myworkdayjobs.com/GEACareers/job/A");
  assert.equal(c.locataire, "gea");
  assert.equal(c.site, "GEACareers");
});

test("sitesDistincts : retient la graphie la plus fréquente d'un même site", () => {
  const r = sitesDistincts(new Map([
    ["gea|wd3|geacareers", 3],
    ["gea|wd3|GEACareers", 41],
  ]));
  assert.deepEqual(r, [{ slug: "gea.wd3/GEACareers", locataire: "gea" }]);
});

test("sitesDistincts : garde TOUTES les vitrines d'un locataire", () => {
  // Cas réel : les 18 offres de PROSOL sont absentes des 343 de GRAND_FRAIS.
  const r = sitesDistincts(new Map([
    ["mouvrh|wd103|External_Career_Site_GRAND_FRAIS", 40],
    ["mouvrh|wd103|External_Career_Site_PROSOL", 7],
  ]));
  assert.deepEqual(r.map((x) => x.slug), [
    "mouvrh.wd103/External_Career_Site_GRAND_FRAIS",
    "mouvrh.wd103/External_Career_Site_PROSOL",
  ]);
});

test("sitesDistincts : ordre stable", () => {
  const r = sitesDistincts(new Map([
    ["zeta|wd1|A", 5],
    ["alpha|wd5|B", 2],
    ["alpha|wd5|C", 9],
  ]));
  assert.deepEqual(r.map((x) => x.slug), ["alpha.wd5/B", "alpha.wd5/C", "zeta.wd1/A"]);
});

test("compterCouples : agrège les adresses d'un bloc, ignore le bruit", () => {
  const bloc = [
    ligneCdx("https://sanofi.wd3.myworkdayjobs.com/SanofiCareers/job/A"),
    ligneCdx("https://sanofi.wd3.myworkdayjobs.com/SanofiCareers/job/B"),
    ligneCdx("https://sanofi.wd3.myworkdayjobs.com/robots.txt"),
    "ligne sans json",
    "com,x)/ 2026 {json invalide",
  ].join("\n");
  assert.deepEqual([...compterCouples(bloc)], [["sanofi|wd3|SanofiCareers", 2]]);
});

/** cluster.idx factice : lignes triées, servi par plages d'octets. */
function faussIndex(lignes, blocs = {}) {
  const cluster = Buffer.from(`${lignes.join("\n")}\n`, "utf8");
  return async (url, init) => {
    if (init?.method === "HEAD") {
      return new Response("", { status: 200, headers: { "content-length": String(cluster.length) } });
    }
    const m = /bytes=(\d+)-(\d+)/.exec(init?.headers?.range ?? "");
    const [debut, fin] = [Number(m[1]), Number(m[2])];
    if (url.includes("cluster.idx")) {
      return new Response(cluster.subarray(debut, fin + 1), { status: 206 });
    }
    const cle = Object.keys(blocs).find((k) => url.includes(k));
    return new Response(gzipSync(Buffer.from(blocs[cle], "utf8")).subarray(debut - debut, fin + 1), { status: 206 });
  };
}

test("blocsDuPrefixe : ne retient que les lignes du préfixe visé", async () => {
  const lignes = [
    "com,aaa)/ 2026\tcdx-00001.gz\t100\t50\t1",
    "com,myworkdayjobs,wd1,alpha)/a 2026\tcdx-00104.gz\t700\t300\t2",
    "com,myworkdayjobs,wd5,zeta)/z 2026\tcdx-00104.gz\t1000\t400\t3",
    "com,zzz)/ 2026\tcdx-00200.gz\t900\t50\t4",
  ];
  const f = faussIndex(lignes);
  const taille = Buffer.from(`${lignes.join("\n")}\n`).length;
  const blocs = await blocsDuPrefixe("CC-MAIN-2026-30", "com,myworkdayjobs,", taille, f);
  assert.deepEqual(blocs, [
    { fichier: "cdx-00104.gz", offset: 700, longueur: 300 },
    { fichier: "cdx-00104.gz", offset: 1000, longueur: 400 },
  ]);
});

test("locatairesWorkday : de l'index aux slugs interrogeables", async () => {
  const bloc = [
    ligneCdx("https://sanofi.wd3.myworkdayjobs.com/SanofiCareers/job/A"),
    ligneCdx("https://sanofi.wd3.myworkdayjobs.com/SanofiCareers/job/B"),
    ligneCdx("https://gea.wd3.myworkdayjobs.com/GEACareers/job/C"),
  ].join("\n");
  const gz = gzipSync(Buffer.from(bloc, "utf8"));
  const lignes = [`com,myworkdayjobs,wd3,gea)/x 2026\tcdx-00104.gz\t0\t${gz.length}\t1`];
  const cluster = Buffer.from(`${lignes.join("\n")}\n`, "utf8");

  const f = async (url, init) => {
    if (init?.method === "HEAD") {
      return new Response("", { status: 200, headers: { "content-length": String(cluster.length) } });
    }
    if (url.includes("cluster.idx")) {
      const m = /bytes=(\d+)-(\d+)/.exec(init.headers.range);
      return new Response(cluster.subarray(Number(m[1]), Number(m[2]) + 1), { status: 206 });
    }
    return new Response(gz, { status: 206 });
  };

  assert.deepEqual(await locatairesWorkday("CC-MAIN-2026-30", f), [
    { slug: "gea.wd3/GEACareers", locataire: "gea" },
    { slug: "sanofi.wd3/SanofiCareers", locataire: "sanofi" },
  ]);
});

test("locatairesWorkday : un index injoignable lève, il ne rend pas une liste vide", async () => {
  const f = async () => new Response("", { status: 503 });
  await assert.rejects(() => locatairesWorkday("CC-MAIN-2026-30", f));
});
