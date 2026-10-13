import { expect, test, type Page } from "@playwright/test";

async function addRecipe(
  page: Page,
  name: string,
  options: { image?: boolean; calories?: number; quantity?: number } = {},
) {
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Recettes", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ajouter une recette", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nom du plat").fill(name);
  await dialog.getByLabel("Nom", { exact: true }).fill("Pâtes");
  await dialog
    .getByLabel("Quantité", { exact: true })
    .fill(String(options.quantity ?? 200));
  await dialog.getByLabel("Rayon").selectOption("Féculents");
  if (options.calories !== undefined)
    await dialog
      .getByLabel("Calories par portion")
      .fill(String(options.calories));
  if (options.image) {
    await dialog.getByLabel("Photo de la recette").setInputFiles({
      name: "photo.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await expect(dialog.locator(".image-editor img")).toBeVisible();
  }
  await dialog.getByRole("button", { name: "Enregistrer la recette" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}
async function repas(page: Page) {
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Repas", exact: true })
    .click();
}
async function select(page: Page, meals: number, portions: number) {
  await page.getByRole("button", { name: "Choisir cette recette" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("spinbutton", {
      name: "Nombre de repas pour ce plat",
      exact: true,
    })
    .fill(String(meals));
  await dialog
    .getByRole("spinbutton", {
      name: "Nombre de repas pour ce plat",
      exact: true,
    })
    .blur();
  await dialog
    .getByRole("spinbutton", { name: "Nombre total de portions", exact: true })
    .fill(String(portions));
  await dialog
    .getByRole("spinbutton", { name: "Nombre total de portions", exact: true })
    .blur();
  await dialog.getByRole("button", { name: "Ajouter au menu" }).click();
  await expect(dialog).not.toBeVisible();
}
async function generate(page: Page) {
  await page
    .getByRole("button", { name: "Générer ma liste de courses", exact: true })
    .click();
  if (await page.getByRole("dialog").isVisible())
    await page.getByRole("button", { name: "Générer et remplacer" }).click();
  await expect(
    page.getByRole("heading", { name: "Vos courses." }),
  ).toBeVisible();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.goto("");
  await expect(
    page.getByRole("heading", { name: "Qu’est-ce qu’on mange ?" }),
  ).toBeVisible();
});

test("parcours complet, photo, calories, portions, persistance et remplacement", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(
    page.getByRole("button", { name: "Ajouter ma première recette" }),
  ).toBeVisible();
  await addRecipe(page, "Carbonara", { image: true, calories: 540 });
  await page.reload();
  await expect(page.locator(".library-card img")).toBeVisible();
  await expect(
    page.getByText("540 kcal / portion", { exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Options" })
    .click();
  await page.getByRole("switch", { name: "Afficher les calories" }).click();
  await page.reload();
  await expect(page.getByRole("switch")).toBeChecked();
  await repas(page);
  await expect(
    page.getByText("540 kcal / portion", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("spinbutton", { name: "Repas à prévoir", exact: true })
    .fill("3");
  await page
    .getByRole("spinbutton", { name: "Repas à prévoir", exact: true })
    .blur();
  await select(page, 3, 10);
  await page.reload();
  await expect(
    page.getByText("3 repas · 10 portions", { exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await generate(page);
  await expect(page.locator(".shopping-row")).toContainText("1 kg");
  await page.getByRole("checkbox").click();
  // Controlled state is confirmed after the IndexedDB transaction commits.
  await expect(page.getByRole("checkbox")).toBeChecked();
  await page.reload();
  await expect(page.getByRole("checkbox")).toBeChecked();
  await page.getByRole("checkbox").click();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await page.reload();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await page.getByRole("checkbox").click();
  await expect(page.getByRole("checkbox")).toBeChecked();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Recettes", exact: true })
    .click();
  await page.getByRole("button", { name: "Modifier", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Quantité", { exact: true })
    .fill("400");
  await page.getByRole("button", { name: "Enregistrer la recette" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Courses", exact: true })
    .click();
  await expect(page.locator(".shopping-row")).toContainText("1 kg");
  await expect(page.getByRole("checkbox")).toBeChecked();
  await repas(page);
  await generate(page);
  await expect(page.locator(".shopping-row")).toContainText("2 kg");
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test("répétition, récapitulatif et limite de repas", async ({ page }) => {
  await addRecipe(page, "Lasagnes");
  await repas(page);
  await page
    .getByRole("spinbutton", { name: "Repas à prévoir", exact: true })
    .fill("2");
  await page
    .getByRole("spinbutton", { name: "Repas à prévoir", exact: true })
    .blur();
  await select(page, 1, 3);
  await page.getByRole("button", { name: "Choisir cette recette" }).click();
  await expect(
    page.getByRole("spinbutton", {
      name: "Nombre de repas pour ce plat",
      exact: true,
    }),
  ).toHaveAttribute("max", "1");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Annuler" })
    .click();
  await select(page, 1, 7);
  await expect(page.locator(".selected-item")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Modifier la sélection : Lasagnes" })
    .first()
    .click();
  await page
    .getByRole("spinbutton", { name: "Nombre total de portions", exact: true })
    .fill("5");
  await page
    .getByRole("spinbutton", { name: "Nombre total de portions", exact: true })
    .blur();
  await page.getByRole("button", { name: "Mettre à jour" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Retirer Lasagnes" }).last().click();
  await expect(page.locator(".selected-item")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Choisir cette recette" }),
  ).toBeEnabled();
  await select(page, 1, 5);
  await generate(page);
  await expect(page.locator(".shopping-row")).toContainText("1 kg");
});

test("cycle sans répétition après rafraîchissement et refus de toutes les recettes", async ({
  page,
}, testInfo) => {
  for (const name of ["Riz", "Pâtes", "Salade", "Soupe"])
    await addRecipe(page, name);
  await repas(page);
  const displayed: string[] = [];
  for (let i = 0; i < 8; i++) {
    const name = await page.locator(".swipe-card h2").innerText();
    displayed.push(name);
    await page.getByRole("button", { name: "Passer cette recette" }).click();
    if (i === 1 || i === 5) {
      await page.waitForTimeout(350);
      await page.reload();
      await expect(page.locator(".swipe-card")).toBeVisible();
    } else if (i % 4 !== 3)
      await expect(page.locator(".swipe-card h2")).not.toHaveText(name);
    else await page.waitForTimeout(350);
  }
  expect(new Set(displayed.slice(0, 4)).size).toBe(4);
  expect(new Set(displayed.slice(4)).size).toBe(4);
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("repas.png"),
    fullPage: true,
  });
});

test("suppression pendant une sélection et maintien de la liste", async ({
  page,
}) => {
  await addRecipe(page, "Poulet au riz");
  await repas(page);
  await page
    .getByRole("spinbutton", { name: "Repas à prévoir", exact: true })
    .fill("1");
  await page
    .getByRole("spinbutton", { name: "Repas à prévoir", exact: true })
    .blur();
  await select(page, 1, 2);
  await generate(page);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Recettes", exact: true })
    .click();
  await page.getByRole("button", { name: "Supprimer Poulet au riz" }).click();
  await expect(page.getByRole("dialog")).toContainText("1 repas associés");
  await page
    .getByRole("button", { name: "Supprimer la recette", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await repas(page);
  await expect(
    page.getByRole("button", { name: "Ajouter ma première recette" }),
  ).toBeVisible();
  await expect(page.locator(".selected-item")).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Courses", exact: true })
    .click();
  await expect(page.locator(".shopping-row")).toContainText("200 g");
});

test("gestes horizontaux, annulation et défilement vertical", async ({
  page,
}, testInfo) => {
  await addRecipe(page, "Plat A");
  await addRecipe(page, "Plat B");
  await repas(page);
  await page
    .locator(".swipe-photo")
    .evaluate((el) => el.scrollIntoView({ block: "center" }));
  const beforeSkip = await page.locator(".swipe-card h2").innerText();
  const box = (await page.locator(".swipe-photo").boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  if (testInfo.project.name === "desktop") {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 110, y + 2, { steps: 12 });
    await page.mouse.up();
  } else {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let i = 1; i <= 10; i++)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x - i * 11, y: y + 1 }],
      });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
  }
  await page.waitForTimeout(350);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".swipe-card h2")).not.toHaveText(beforeSkip);
  const afterSkip = await page.locator(".swipe-card h2").innerText();
  await page
    .locator(".swipe-photo")
    .evaluate((el) => el.scrollIntoView({ block: "center" }));
  const box2 = (await page.locator(".swipe-photo").boundingBox())!;
  await page.mouse.move(box2.x + 50, box2.y + 50);
  await page.mouse.down();
  await page.mouse.move(box2.x + 175, box2.y + 52, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.locator(".swipe-card h2")).toHaveText(afterSkip);
  if (testInfo.project.name !== "desktop") {
    const before = await page.evaluate(() => scrollY);
    const cdp = await page.context().newCDPSession(page);
    const box3 = (await page.locator(".swipe-photo").boundingBox())!;
    const vx = box3.x + box3.width / 2,
      vy = box3.y + box3.height / 2;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: vx, y: vy }],
    });
    for (let i = 1; i <= 8; i++)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: vx + 1, y: vy - i * 14 }],
      });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(() => page.evaluate(() => scrollY))
      .toBeGreaterThan(before);
    await expect(page.locator(".swipe-card h2")).toHaveText(afterSkip);
    await cdp.detach();
  }
  await noOverflow(page);
});

test("formulaire : validation, lignes, photo remplacée et supprimée", async ({
  page,
}) => {
  await addRecipe(page, "Une recette", { image: true });
  await page.getByRole("button", { name: "Modifier", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const previousPhoto = await dialog
    .locator(".image-editor img")
    .getAttribute("src");
  await dialog.getByLabel("Photo de la recette").setInputFiles({
    name: "replacement.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(dialog.locator(".image-editor img")).not.toHaveAttribute(
    "src",
    previousPhoto!,
  );
  await dialog.getByRole("button", { name: "Enregistrer la recette" }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(page.locator(".library-card img")).toBeVisible();
  await page.getByRole("button", { name: "Modifier", exact: true }).click();
  await dialog.getByLabel("Quantité", { exact: true }).fill("-1");
  await dialog.getByRole("button", { name: "Enregistrer la recette" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Quantité", { exact: true }).fill("0.1");
  await dialog.getByRole("button", { name: "Ajouter un ingrédient" }).click();
  await dialog.getByLabel("Nom", { exact: true }).last().fill("Lait");
  await dialog.getByLabel("Quantité", { exact: true }).last().fill("0.25");
  await dialog.getByLabel("Unité").last().selectOption("L");
  await dialog.getByRole("button", { name: "Supprimer la photo" }).click();
  await expect(dialog.locator(".image-editor img")).not.toBeVisible();
  await noOverflow(page);
  await dialog.getByRole("button", { name: "Enregistrer la recette" }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(page.locator(".library-card img")).not.toBeVisible();
  await page.getByRole("button", { name: "Consulter Une recette" }).click();
  await expect(page.getByRole("dialog")).toContainText("0,25 L");
  await expect(page.getByRole("dialog")).toContainText("0,1 g");
});

test("navigation vide et réglage des calories", async ({ page }) => {
  for (const tab of ["Recettes", "Courses", "Options", "Repas"]) {
    await page
      .getByRole("navigation")
      .getByRole("link", { name: tab, exact: true })
      .click();
    await noOverflow(page);
    await expect(
      page
        .getByRole("navigation")
        .getByRole("link", { name: tab, exact: true }),
    ).toHaveAttribute("aria-current", "page");
  }
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Options", exact: true })
    .click();
  await expect(page.getByRole("switch")).not.toBeChecked();
  await page.getByRole("switch").click();
  await page.reload();
  await expect(page.getByRole("switch")).toBeChecked();
});

test("jeu d’essai : chargement facultatif, conservation et identifiants sans randomUUID", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window.crypto, "randomUUID", {
      configurable: true,
      value: undefined,
    }),
  );
  await page.goto("?essai=1");
  await addRecipe(page, "Mon plat personnel");
  await page
    .getByRole("button", { name: "Charger les 8 recettes d’essai" })
    .click();
  await expect(page.locator(".library-card")).toHaveCount(9);
  await expect(
    page.getByRole("button", { name: "Recettes d’essai chargées" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "Mon plat personnel", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".library-card")).toHaveCount(9);
  await noOverflow(page);
  await repas(page);
  await page
    .getByRole("spinbutton", { name: "Repas à prévoir", exact: true })
    .fill("1");
  await page
    .getByRole("spinbutton", { name: "Repas à prévoir", exact: true })
    .blur();
  await select(page, 1, 3);
  await generate(page);
  await expect(page.locator(".shopping-row")).toBeVisible();
});
