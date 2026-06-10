const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('resume-form.js', () => {
  let pageUrl;

  test.beforeAll(async () => {
    pageUrl = 'file://' + path.resolve(__dirname, 'resume_form_test.html');
  });

  test('normalizes missing sections and renders basic HTML', async ({ page }) => {
    await page.goto(pageUrl);

    // Initialize the form
    await page.evaluate(() => {
      window.ResumeForm.init();
    });

    // Load data including the new fields: projects, certifications, volunteer
    const mockData = {
      name: "Jean Dupont",
      title: "Dev",
      projects: [{title: "Projet Alpha", date: "2024", description: "Desc"}],
      certifications: ["Certif 1", "Certif 2"],
      volunteer: [{title: "Bénévole", organization: "Asso", location: "Paris", date: "2023", bullets: ["Aidé"]}]
    };

    await page.evaluate((data) => {
      window.ResumeForm.loadData(data);
    }, mockData);

    // Get the HTML output
    const generatedHtml = await page.evaluate(() => window.htmlModel.getValue());

    // Check that it contains the basic information
    expect(generatedHtml).toContain("Jean Dupont");
    expect(generatedHtml).toContain("Dev");

    // Check that projects, certifications, and volunteer are correctly rendered
    expect(generatedHtml).toContain("Projets");
    expect(generatedHtml).toContain("Projet Alpha");
    expect(generatedHtml).toContain("Desc");
    expect(generatedHtml).toContain("Certifications");
    expect(generatedHtml).toContain("Certif 1");
    expect(generatedHtml).toContain("Certif 2");
    expect(generatedHtml).toContain("Benevolat");
    expect(generatedHtml).toContain("Bénévole");
    expect(generatedHtml).toContain("Asso");
    expect(generatedHtml).toContain("Aidé");
  });
});
