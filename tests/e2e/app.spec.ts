import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { CiqualDatabase } from "../../src/types";
const ciqualDatabase: CiqualDatabase = JSON.parse(
  readFileSync("src/data/ciqual-2025.json", "utf8"),
);
const imageFile = {
  name: "photo.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=",
    "base64",
  ),
};
async function nav(page: Page, label: string) {
  await page
    .getByRole("navigation")
    .getByRole("link", { name: label, exact: true })
    .click();
}
async function addRecipe(page: Page, name: string, image = false) {
  await nav(page, "Recette");
  await page
    .getByRole("button", { name: "Ajouter une recette", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nom du plat").fill(name);
  await dialog.getByLabel("Nom", { exact: true }).fill("Pâtes");
  await dialog.getByLabel("Quantité", { exact: true }).fill("200");
  await dialog.getByLabel("Rayon").selectOption("Féculents");
  if (image) {
    await dialog.getByLabel("Photo de la recette").setInputFiles(imageFile);
    await expect(dialog.locator(".image-editor img")).toBeVisible();
  }
  await dialog.getByRole("button", { name: "Enregistrer la recette" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}
async function start(page: Page, target: number) {
  await nav(page, "Faites vos courses !");
  await page
    .getByRole("spinbutton", { name: "Nombre de repas à prévoir", exact: true })
    .fill(String(target));
  await page
    .getByRole("spinbutton", { name: "Nombre de repas à prévoir", exact: true })
    .blur();
  await page.getByRole("button", { name: "Choisir mes repas" }).click();
}
async function swipe(page: Page, right: boolean, touch: boolean) {
  await page
    .locator(".swipe-photo")
    .evaluate((el) => el.scrollIntoView({ block: "center" }));
  const box = (await page.locator(".swipe-photo").boundingBox())!,
    x = box.x + box.width / 2,
    y = box.y + box.height / 2,
    direction = right ? 1 : -1;
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let i = 1; i <= 10; i++)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + direction * i * 12, y: y + 1 }],
      });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + direction * 120, y + 1, { steps: 12 });
    await page.mouse.up();
  }
  await expect
    .poll(() =>
      page.evaluate(() => {
        const card = document.querySelector(".swipe-card");
        return card
          ? card.getAttribute("aria-busy") === "false"
          : !!document.querySelector(".shopping-screen");
      }),
    )
    .toBe(true);
}
async function portions(page: Page, n: number) {
  await page
    .getByRole("spinbutton", { name: "Nombre total de portions", exact: true })
    .fill(String(n));
  await page
    .getByRole("spinbutton", { name: "Nombre total de portions", exact: true })
    .blur();
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
    page.getByRole("heading", { name: "Faites vos courses !", exact: true }),
  ).toBeVisible();
});

async function chooseIngredient(page: Page, code: string, touch = false) {
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nom", { exact: true }).fill(code);
  const choice = dialog
    .locator(".ingredient-autocomplete")
    .getByRole("option")
    .filter({ hasText: "Code " + code })
    .first();
  if (touch) await choice.tap();
  else await choice.click();
}
async function enableNutrition(page: Page) {
  await nav(page, "Options");
  await page.getByRole("switch").click();
  await expect(page.getByRole("switch")).toBeChecked();
}
test("autocomplétion : familles sans section Ciqual et profil générique persistant", async ({
  page,
}, info) => {
  await nav(page, "Recette");
  await page
    .getByRole("button", { name: "Ajouter une recette", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog"),
    name = dialog.getByLabel("Nom", { exact: true });
  await dialog.getByLabel("Nom du plat").fill("Mes pâtes Ciqual");
  await name.fill("pâtes");
  const suggestions = dialog.locator(".ingredient-autocomplete");
  await expect(
    suggestions.getByRole("group", { name: "Pâtes", exact: true }),
  ).toBeVisible();
  await name.press("Enter");
  await expect(dialog).toBeVisible();
  await name.press("ArrowDown");
  await name.press("Enter");
  await expect(name).toHaveValue("Pâtes sèches, standard, crues");
  await name.fill("tagliatelles");
  const choice = suggestions
    .getByRole("option")
    .filter({ hasText: "Tagliatelles (sèches, crues)" });
  if (info.project.use.isMobile) await choice.tap();
  else await choice.click();
  await dialog.getByLabel("Quantité", { exact: true }).fill("100");
  await expect(dialog.locator(".ciqual-fields")).toHaveCount(0);
  await expect(
    dialog.getByText("Aliment nutritionnel", { exact: false }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Retirer l’association" }),
  ).toHaveCount(0);
  await expect(dialog.locator(".nutrition-summary")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Enregistrer la recette" }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Consulter Mes pâtes Ciqual" })
    .click();
  await expect(dialog.locator(".nutrition-summary")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Modifier la recette" }).click();
  await expect(name).toHaveValue("Tagliatelles (sèches, crues)");
  await name.fill("pois-chiche");
  await expect(
    suggestions.getByRole("group", { name: "Pois chiches", exact: true }),
  ).toBeVisible();
  for (const code of ["20516", "20532", "20507"])
    await expect(
      suggestions.getByRole("option").filter({ hasText: "Code " + code }),
    ).toBeVisible();
  await name.press("Escape");
  await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
  await enableNutrition(page);
  await start(page, 1);
  await expect(page.locator(".nutrition-energyKcal dd")).toHaveText(
    "~182 kcal",
  );
  await expect(page.locator(".nutrition-energyKcal")).toContainText(
    "Profil générique",
  );
  await expect(page.locator(".nutrition-summary")).not.toContainText(
    "par portion",
  );
  await noOverflow(page);
});
test("Ciqual : conversion, entiers approximatifs et persistance sans réseau", async ({
  page,
  context,
}, info) => {
  await nav(page, "Recette");
  await page
    .getByRole("button", { name: "Ajouter une recette", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nom du plat").fill("Huile mesurée");
  await context.setOffline(true);
  await chooseIngredient(page, "17270", !!info.project.use.isMobile);
  await dialog.getByLabel("Quantité", { exact: true }).fill("20");
  await dialog
    .getByRole("combobox", { name: "Unité", exact: true })
    .selectOption("ml");
  await dialog.getByLabel("Grammes pour 1 ml").fill("0.92");
  await expect(dialog.locator(".ciqual-fields")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Enregistrer la recette" }).click();
  await expect(dialog).not.toBeVisible();
  await context.setOffline(false);
  await page.reload();
  await page
    .locator(".library-card")
    .getByRole("button", { name: "Modifier", exact: true })
    .click();
  await expect(dialog.getByLabel("Grammes pour 1 ml")).toHaveValue("0.92");
  await dialog.getByRole("button", { name: "Enregistrer la recette" }).click();
  await expect(dialog).not.toBeVisible();
  await start(page, 1);
  await expect(page.locator(".nutrition-summary")).toHaveCount(0);
  await enableNutrition(page);
  await nav(page, "Faites vos courses !");
  const summary = page.locator(".nutrition-summary");
  await expect(page.locator(".nutrition-energyKcal dd")).toHaveText("~83 kcal");
  await expect(page.locator(".nutrition-proteinG dd")).toHaveText("~1 g");
  await expect(page.locator(".nutrition-carbohydrateG dd")).toHaveText("—");
  await expect(page.locator(".nutrition-fatG dd")).toHaveText("~10 g");
  await expect(summary).not.toContainText("par portion");
  const values = await summary.innerText();
  await portions(page, 3);
  await expect(summary).toHaveText(values, { useInnerText: true });
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath("nutrition-rounded.png"),
    fullPage: false,
  });
  await swipe(page, true, !!info.project.use.isMobile);
  await expect(page.locator(".shopping-row")).toContainText("30 ml");
});
test("Ciqual : variantes, conversions et seuils arrondis sans inventer les valeurs absentes", async ({
  page,
}, info) => {
  await nav(page, "Recette");
  await page
    .getByRole("button", { name: "Ajouter une recette", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nom du plat").fill("Tomates Ciqual");
  await chooseIngredient(page, "20835", !!info.project.use.isMobile);
  await expect(dialog.getByLabel("Nom", { exact: true })).toHaveValue(/crue/);
  await chooseIngredient(page, "20242", !!info.project.use.isMobile);
  await expect(dialog.getByLabel("Nom", { exact: true })).toHaveValue(/cuite/);
  await dialog
    .getByRole("combobox", { name: "Unité", exact: true })
    .selectOption("unité");
  await dialog.getByLabel("Grammes pour 1 unité").fill("50");
  await dialog
    .getByRole("combobox", { name: "Unité", exact: true })
    .selectOption("c. à soupe");
  await expect(dialog.getByLabel("Grammes pour 1 c. à soupe")).toHaveValue("");
  await chooseIngredient(page, "20169", !!info.project.use.isMobile);
  await dialog
    .getByRole("combobox", { name: "Unité", exact: true })
    .selectOption("g");
  await expect(dialog.locator(".ingredient-mass")).toHaveCount(0);
  await dialog.getByLabel("Quantité", { exact: true }).fill("100");
  await dialog.getByRole("button", { name: "Enregistrer la recette" }).click();
  await expect(dialog).not.toBeVisible();
  await enableNutrition(page);
  await start(page, 1);
  await expect(page.locator(".nutrition-energyKcal dd")).toHaveText("12 kcal");
  await expect(page.locator(".nutrition-fatG dd")).toHaveText("~1 g");
  await nav(page, "Recette");
  await page
    .locator(".library-card")
    .getByRole("button", { name: "Modifier", exact: true })
    .click();
  const missing = ciqualDatabase.foods.find(
    (food) =>
      food.isIngredientCandidate === true &&
      food.per100g.energyKcal.qualifier === "missing",
  )!;
  await chooseIngredient(page, missing.ciqualCode, !!info.project.use.isMobile);
  await dialog.getByRole("button", { name: "Enregistrer la recette" }).click();
  await expect(dialog).not.toBeVisible();
  await nav(page, "Faites vos courses !");
  await expect(page.locator(".nutrition-energyKcal dd")).toHaveText("—");
});

test("trois onglets, arrivée sur la question et nutrition facultative", async ({
  page,
}, info) => {
  await expect(page.getByRole("navigation").getByRole("link")).toHaveCount(3);
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "Faites vos courses !" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".swipe-card")).toHaveCount(0);
  for (const label of ["Recette", "Options", "Faites vos courses !"]) {
    await nav(page, label);
    await noOverflow(page);
  }
  await nav(page, "Options");
  await expect(page.getByRole("switch")).toBeEnabled();
  await expect(page.getByRole("switch")).not.toBeChecked();
  await expect(
    page.getByText("Calcul local avec Ciqual 2025.", { exact: false }),
  ).toBeVisible();
  await page.goto("");
  await expect(
    page.getByRole("heading", { name: "Faites vos courses !", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("objectif.png"),
    fullPage: true,
  });
});

test("photo, swipe seulement, liste persistante et fin explicite des courses", async ({
  page,
  context,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await addRecipe(page, "Carbonara", true);
  await page.reload();
  await expect(page.locator(".library-card img")).toBeVisible();
  await start(page, 3);
  await expect(page.locator(".swipe-card")).toBeVisible();
  await expect(page.locator(".swipe-card button")).toHaveCount(0);
  await expect(page.locator(".swipe-card")).not.toContainText("540");
  await expect(
    page.getByRole("button", { name: "Voir la recette" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Augmenter le nombre de repas pour ce plat" })
    .click();
  await page
    .getByRole("button", { name: "Augmenter le nombre de repas pour ce plat" })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Augmenter le nombre de repas pour ce plat",
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("spinbutton", {
      name: "Nombre total de portions",
      exact: true,
    }),
  ).toHaveValue("6");
  await page
    .getByRole("button", { name: "Augmenter le nombre total de portions" })
    .click();
  await expect(
    page.getByRole("spinbutton", {
      name: "Nombre total de portions",
      exact: true,
    }),
  ).toHaveValue("7");
  await page
    .getByRole("button", { name: "Diminuer le nombre total de portions" })
    .click();
  await expect(
    page.getByRole("spinbutton", {
      name: "Nombre total de portions",
      exact: true,
    }),
  ).toHaveValue("6");
  await portions(page, 10);
  await swipe(page, true, info.project.name !== "desktop");
  await expect(
    page.getByRole("heading", { name: "Votre liste de courses" }),
  ).toBeVisible();
  await expect(page.locator(".shopping-row")).toContainText("1 kg");
  await expect(page.locator(".swipe-card")).toHaveCount(0);
  await page.getByRole("checkbox").click();
  await expect(page.getByRole("checkbox")).toBeChecked();
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto("");
  await expect(
    reopened.getByRole("heading", { name: "Votre liste de courses" }),
  ).toBeVisible();
  await expect(reopened.getByRole("checkbox")).toBeChecked();
  await nav(reopened, "Options");
  await nav(reopened, "Faites vos courses !");
  await expect(reopened.locator(".swipe-card")).toHaveCount(0);
  await reopened.goto("#repas");
  await expect(
    reopened.getByRole("heading", { name: "Votre liste de courses" }),
  ).toBeVisible();
  await reopened.getByRole("checkbox").click();
  await expect(reopened.getByRole("checkbox")).not.toBeChecked();
  await reopened.reload();
  await expect(reopened.getByRole("checkbox")).not.toBeChecked();
  await noOverflow(reopened);
  await reopened.screenshot({
    path: info.outputPath("courses.png"),
    fullPage: true,
  });
  await reopened
    .getByRole("button", { name: "Courses terminées", exact: true })
    .click();
  await expect(
    reopened.getByRole("heading", {
      name: "Faites vos courses !",
      exact: true,
    }),
  ).toBeVisible();
  await reopened.reload();
  await expect(reopened.locator(".shopping-screen")).toHaveCount(0);
  await start(reopened, 1);
  await swipe(reopened, true, info.project.name !== "desktop");
  await expect(reopened.getByRole("checkbox")).not.toBeChecked();
  expect(errors).toEqual([]);
});

test("la modification et suppression de recettes préserve la liste active", async ({
  page,
}, info) => {
  await addRecipe(page, "Mon plat");
  await start(page, 1);
  await swipe(page, true, info.project.name !== "desktop");
  await nav(page, "Recette");
  await page.getByRole("button", { name: "Modifier", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Quantité", { exact: true })
    .fill("400");
  await page.getByRole("button", { name: "Enregistrer la recette" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await nav(page, "Faites vos courses !");
  await expect(page.locator(".shopping-row")).toContainText("200 g");
  await nav(page, "Recette");
  await page.getByRole("button", { name: "Supprimer Mon plat" }).click();
  await page
    .getByRole("button", { name: "Supprimer la recette", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await nav(page, "Faites vos courses !");
  await expect(page.locator(".shopping-row")).toContainText("200 g");
  await page.getByRole("button", { name: "Courses terminées" }).click();
  await start(page, 1);
  await expect(
    page.getByRole("heading", { name: "Ajoutez votre première recette" }),
  ).toBeVisible();
});

test("cycles de refus sans doublons et reprise du swipe après rechargement", async ({
  page,
}, info) => {
  for (const name of ["Riz", "Pâtes", "Salade", "Soupe"])
    await addRecipe(page, name);
  await start(page, 7);
  const displayed: string[] = [];
  for (let i = 0; i < 8; i++) {
    displayed.push(await page.locator(".swipe-card h2").innerText());
    await swipe(page, false, info.project.name !== "desktop");
    if (i === 1 || i === 5) {
      const current = await page.locator(".swipe-card h2").innerText();
      await page.reload();
      await expect(page.locator(".swipe-card h2")).toHaveText(current);
    }
  }
  expect(new Set(displayed.slice(0, 4)).size).toBe(4);
  expect(new Set(displayed.slice(4)).size).toBe(4);
  await expect(page.locator(".shopping-screen")).toHaveCount(0);
  await noOverflow(page);
  await page.screenshot({ path: info.outputPath("swipe.png"), fullPage: true });
});

test("quantités indépendantes, récapitulatif et suppression pendant le swipe", async ({
  page,
}, info) => {
  await addRecipe(page, "Lasagnes");
  await start(page, 3);
  await portions(page, 3);
  await swipe(page, true, info.project.name !== "desktop");
  await expect(
    page.getByText("1 / 3 repas sélectionnés", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("1 / 3 repas sélectionnés", { exact: true }),
  ).toBeVisible();
  await page.locator(".selection-details summary").click();
  await page
    .getByRole("button", { name: "Modifier la sélection : Lasagnes" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("spinbutton", { name: "Nombre total de portions", exact: true })
    .fill("5");
  await page
    .getByRole("dialog")
    .getByRole("spinbutton", { name: "Nombre total de portions", exact: true })
    .blur();
  await page.getByRole("button", { name: "Mettre à jour" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Retirer Lasagnes" }).click();
  await expect(
    page.getByText("0 / 3 repas sélectionnés", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Augmenter le nombre de repas pour ce plat" })
    .click();
  await page
    .getByRole("button", { name: "Augmenter le nombre de repas pour ce plat" })
    .click();
  await portions(page, 10);
  await swipe(page, true, info.project.name !== "desktop");
  await expect(page.locator(".shopping-row")).toContainText("1 kg");
});

test("swipe court ou vertical ne choisit pas, carte utilisable au clavier", async ({
  page,
}, info) => {
  await addRecipe(page, "Plat A");
  await addRecipe(page, "Plat B");
  await start(page, 2);
  await page
    .locator(".swipe-photo")
    .evaluate((el) => el.scrollIntoView({ block: "center" }));
  const name = await page.locator(".swipe-card h2").innerText();
  const box = (await page.locator(".swipe-photo").boundingBox())!,
    x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 35, y + 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator(".swipe-card h2")).toHaveText(name);
  await expect(
    page.getByText("0 / 2 repas sélectionnés", { exact: true }),
  ).toBeVisible();
  if (info.project.name !== "desktop") {
    const before = await page.evaluate(() => scrollY);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let i = 1; i <= 8; i++)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + 1, y: y - i * 12 }],
      });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
    await expect
      .poll(() => page.evaluate(() => scrollY))
      .toBeGreaterThan(before);
    await expect(page.locator(".swipe-card h2")).toHaveText(name);
  }
  await page.locator(".swipe-card").focus();
  await page.locator(".swipe-card").press("ArrowRight");
  await expect(
    page.getByText("1 / 2 repas sélectionnés", { exact: true }),
  ).toBeVisible();
  await noOverflow(page);
});

test("formulaire, photo remplacée puis supprimée et validation", async ({
  page,
}) => {
  await addRecipe(page, "Une recette", true);
  await page.getByRole("button", { name: "Modifier", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const oldPhoto = await dialog
    .locator(".image-editor img")
    .getAttribute("src");
  await dialog
    .getByLabel("Photo de la recette")
    .setInputFiles({ ...imageFile, name: "replacement.png" });
  await expect(dialog.locator(".image-editor img")).not.toHaveAttribute(
    "src",
    oldPhoto!,
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
  await noOverflow(page);
  await dialog.getByRole("button", { name: "Enregistrer la recette" }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(page.locator(".library-card img")).toHaveCount(0);
  await page.getByRole("button", { name: "Consulter Une recette" }).click();
  await expect(dialog).toContainText("0,25 L");
  await expect(dialog).toContainText("0,1 g");
});

test("jeu d’essai conserve les recettes et fonctionne sans randomUUID", async ({
  page,
}, info) => {
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
  await page.reload();
  await expect(page.locator(".library-card")).toHaveCount(9);
  await noOverflow(page);
  await start(page, 1);
  await swipe(page, true, info.project.name !== "desktop");
  await expect(page.locator(".shopping-row")).toBeVisible();
});

test("navbar en arc fixe au bas du viewport pendant le défilement", async ({
  page,
}, info) => {
  await page.goto("?essai=1#recettes");
  await page
    .getByRole("button", { name: "Charger les 8 recettes d’essai" })
    .click();
  await expect(page.locator(".library-card")).toHaveCount(8);
  const bounds = () =>
    page.evaluate(() => {
      const nav = document.querySelector(".bottom-nav")!;
      const box = nav.getBoundingClientRect();
      return {
        bottom: box.bottom,
        left: box.left,
        right: box.right,
        height: box.height,
        viewportHeight: innerHeight,
        viewportWidth: innerWidth,
        position: getComputedStyle(nav).position,
        transform: getComputedStyle(nav).transform,
        parent: nav.parentElement?.tagName,
        icons: Array.from(nav.querySelectorAll("svg"), (icon) => {
          const r = icon.getBoundingClientRect();
          return { x: r.x, y: r.y };
        }),
      };
    });
  const initial = await bounds();
  expect(initial.position).toBe("fixed");
  expect(initial.transform).toBe("none");
  expect(initial.parent).toBe("BODY");
  expect(Math.abs(initial.bottom - initial.viewportHeight)).toBeLessThan(1);
  expect(initial.left).toBe(0);
  expect(initial.right).toBe(initial.viewportWidth);
  expect(initial.icons[1]!.y).toBeLessThan(initial.icons[0]!.y);
  expect(initial.icons[1]!.y).toBeLessThan(initial.icons[2]!.y);
  for (const progress of [0.5, 1, 0]) {
    await page.evaluate(
      (fraction) =>
        window.scrollTo(
          0,
          (document.documentElement.scrollHeight - innerHeight) * fraction,
        ),
      progress,
    );
    const next = await bounds();
    expect(Math.abs(next.bottom - next.viewportHeight)).toBeLessThan(1);
    next.icons.forEach((icon, index) => {
      expect(Math.abs(icon.x - initial.icons[index]!.x)).toBeLessThan(1);
      expect(Math.abs(icon.y - initial.icons[index]!.y)).toBeLessThan(1);
    });
  }
  await nav(page, "Options");
  const switched = await bounds();
  switched.icons.forEach((icon, index) => {
    expect(Math.abs(icon.y - initial.icons[index]!.y)).toBeLessThan(1);
  });
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ ...viewport, height: viewport.height - 120 });
  const resized = await bounds();
  expect(Math.abs(resized.bottom - resized.viewportHeight)).toBeLessThan(1);
  await page.setViewportSize(viewport);
  await nav(page, "Recette");
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.getByRole("navigation")).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: info.outputPath("navbar-arc.png") });
});
