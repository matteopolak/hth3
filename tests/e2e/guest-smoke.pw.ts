import { expect, test } from "@playwright/test";

const copy = {
  en: {
    language: "Language",
    jobs: "Find your next role",
    assistant: "Assistant",
    official: "Open official site",
    practiceListing: "Practice listing",
    map: "Map",
    list: "List",
    feedbackMessage: "What happened?",
    review: "Review before sending",
    reviewTitle: "Review your report",
    duplicateTitle: "A similar issue is already being tracked",
    separate:
      "This is a different issue or a recurrence. Send a separate report.",
    acknowledgement:
      "I understand this report goes to Envoy's review team and is not sent to a government office.",
    submitSeparate: "Submit separate report",
    edit: "Edit report",
    searchChats: "Search chats",
  },
  fr: {
    language: "Langue",
    jobs: "Trouvez votre prochain emploi",
    assistant: "Assistant",
    official: "Ouvrir le site officiel",
    practiceListing: "Offre d’exercice",
    map: "Carte",
    list: "Liste",
    feedbackMessage: "Que s’est-il passé?",
    review: "Vérifier avant l’envoi",
    reviewTitle: "Vérifiez votre avis",
    duplicateTitle: "Un problème semblable est déjà suivi",
    separate:
      "Il s’agit d’un autre problème ou d’une récidive. Envoyer un rapport distinct.",
    acknowledgement:
      "Je comprends que mon avis va à l’équipe d’Envoy chargée des avis et n’est pas envoyé à un organisme gouvernemental.",
    submitSeparate: "Envoyer un rapport distinct",
    edit: "Modifier l’avis",
    searchChats: "Chercher une conversation",
  },
} as const;

for (const locale of ["en", "fr"] as const) {
  const label = copy[locale];

  test(`${locale}: direct route, history, sample label and official handoff`, async ({
    page,
    context,
  }) => {
    await page.addInitScript(
      (selected) => localStorage.setItem("civicresolve.locale", selected),
      locale,
    );
    await context.route(/^https:\/\//, (route) =>
      route.fulfill({ status: 200, body: "Official handoff checked." }),
    );
    await page.goto("/explore/jobs");
    await expect(page.locator("main h2").first()).toHaveText(label.jobs);
    await expect(page.locator(".discovery-row").first()).toBeVisible();

    await page
      .locator(".primary-nav")
      .getByRole("button", { name: label.assistant, exact: true })
      .click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("main .chat-shell")).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/explore\/jobs$/);
    await expect(page.locator("main h2").first()).toHaveText(label.jobs);

    await page.goto("/applications");
    await expect(page.locator(".ja-kicker")).toHaveText(label.practiceListing);
    await expect(page.locator(".ja-note")).toBeVisible();
    await page.goto("/explore/jobs");
    await expect(page.locator(".discovery-detail")).toBeVisible();

    const popupPromise = page.waitForEvent("popup");
    const handoffPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/handoff") && response.status() === 200,
    );
    await page.getByRole("button", { name: label.official }).click();
    const [popup, handoff] = await Promise.all([popupPromise, handoffPromise]);
    const payload = (await handoff.json()) as { handoff: { url: string } };
    await expect(popup).toHaveURL(payload.handoff.url);
    expect(new URL(popup.url()).protocol).toBe("https:");
    await popup.close();
  });

  test(`${locale}: Nearby map/list, feedback duplicate review and keyboard`, async ({
    page,
  }) => {
    await page.addInitScript(
      (selected) => localStorage.setItem("civicresolve.locale", selected),
      locale,
    );
    await page.goto("/explore/nearby");
    await expect(page.locator(".discovery-row").first()).toBeVisible();
    await page.getByRole("button", { name: label.map, exact: true }).click();
    await expect(page.locator(".discovery-map")).toBeVisible();
    await expect(page.locator(".discovery-map-key-row").first()).toBeVisible();
    await page.getByRole("button", { name: label.list, exact: true }).click();
    await expect(page.locator(".discovery-row").first()).toBeVisible();

    await page.route("**/api/v1/feedback/duplicate-check", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          apiVersion: "v1",
          duplicate: { status: "in_review" },
        }),
      }),
    );
    await page.goto("/feedback");
    const report =
      "The library entrance ramp remains blocked by construction fencing this week.";
    await page
      .getByRole("textbox", { name: label.feedbackMessage })
      .fill(report);
    await page.getByRole("button", { name: label.review }).click();
    await expect(
      page.getByRole("heading", { name: label.reviewTitle }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: label.duplicateTitle }),
    ).toBeVisible();
    const submit = page.getByRole("button", { name: label.submitSeparate });
    await expect(submit).toBeDisabled();
    await page.getByRole("checkbox", { name: label.separate }).check();
    await page.getByRole("checkbox", { name: label.acknowledgement }).check();
    await expect(submit).toBeEnabled();
    await page.getByRole("button", { name: label.edit }).click();
    await expect(
      page.getByRole("textbox", { name: label.feedbackMessage }),
    ).toHaveValue(report);

    const search = page.locator(".sidebar-search-button");
    await search.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("dialog", { name: label.searchChats }),
    ).toBeVisible();
    await expect(page.locator(".search-dialog-input")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: label.searchChats }),
    ).toHaveCount(0);
    await expect(search).toBeFocused();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/feedback");
    const menu = page.locator(".mobile-menu-button");
    await menu.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".app-shell")).toHaveClass(/sidebar-is-open/);
    await expect(page.locator(".sidebar-search-button")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator(".app-shell")).not.toHaveClass(/sidebar-is-open/);
    await expect(menu).toBeFocused();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
}
