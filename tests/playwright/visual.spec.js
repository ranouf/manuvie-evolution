import { test, expect, chromium } from "@playwright/test";
import path from "node:path";

test("loads the unpacked extension in Chromium and crosses isolated worlds", async () => {
  const extensionPath = path.resolve(".");
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const page = await context.newPage();
  await page.route("https://manulifewealth.myinvestorportal.ca/overview", async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><html lang="fr"><body><h1>Portail Manuvie</h1><script>
        const headers = { MFP: "test-token", language: "fr" };
        const load = async (url) => {
          const queued = await fetch(url, { headers }).then(response => response.json());
          await fetch("https://api.myinvestorportal.ca/async-api/result?queryId=" + queued.queryId, { headers });
        };
        load("https://api.myinvestorportal.ca/portfoliosummary/account/v2/investorId/demo/language/fr");
      </script></body></html>`,
    });
  });
  await page.route("https://api.myinvestorportal.ca/**", async (route) => {
    const url = route.request().url();
    const queryId = new URL(url).searchParams.get("queryId");
    const result =
      queryId === "accounts"
        ? { accountList: [] }
        : {
            marketValue: [[Date.UTC(2026, 0, 1), 150000]],
            netInvestedCapital: [[Date.UTC(2026, 0, 1), 120000]],
            performance: { returnOnInvestment: 12.5 },
          };
    const body = queryId
      ? { queryId, pollingFlag: false, result, throwable: null }
      : url.includes("/account/v2/")
        ? { queryId: "accounts" }
        : url.includes("/transactions/")
          ? { transactionList: [] }
          : { queryId: "performance" };
    await route.fulfill({
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "https://manulifewealth.myinvestorportal.ca",
        "access-control-allow-credentials": "true",
      },
      body: JSON.stringify(body),
    });
  });

  await page.goto("https://manulifewealth.myinvestorportal.ca/overview");
  const hasPageHorizontalOverflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
  await expect(page.getByRole("button", { name: "Ouvrir Manuvie Évolution" })).toContainText(
    "v0.2.21",
  );
  await expect(hasPageHorizontalOverflow()).resolves.toBe(false);
  await page.getByRole("button", { name: "Ouvrir Manuvie Évolution" }).click();
  await expect(page.getByRole("heading", { name: "Gains de vos placements" })).toBeVisible();
  await expect(hasPageHorizontalOverflow()).resolves.toBe(false);
  await context.close();
});

test("hydrates cached history and requests only fresh years", async ({ page }) => {
  await page.setContent('<!doctype html><html lang="fr"><body></body></html>');
  await page.addStyleTag({ path: path.resolve("src/styles.css") });
  await page.addScriptTag({ path: path.resolve("src/analytics.js") });
  const currentYear = new Date().getFullYear();
  const cachedYear = currentYear - 1;
  const currentDate = Date.UTC(currentYear, 0, 31);
  const cachedDate = Date.UTC(cachedYear, 11, 31);
  await page.evaluate(
    ({ cachedDate, cachedYear, currentDate }) => {
      const cacheKey = "manuvie-evolution:v1:demo";
      const cache = {
        accounts: { accountList: [{ account: "DEMOREER", accountType: "REER" }] },
        total: {
          marketValue: [
            [cachedDate, 140000],
            [currentDate, 150000],
          ],
          netInvestedCapital: [
            [cachedDate, 120000],
            [currentDate, 125000],
          ],
        },
        accountCharts: {
          DEMOREER: {
            marketValue: [
              [cachedDate, 140000],
              [currentDate, 150000],
            ],
            netInvestedCapital: [
              [cachedDate, 120000],
              [currentDate, 125000],
            ],
          },
        },
        years: {
          [cachedYear]: {
            transactions: [
              {
                accountNumber: "DEMOREER",
                transactionType: "Frais De Programme À Honoraires",
                securityDescription: "PREMIER FEE",
                tradeDate: `15/06/${cachedYear}`,
                totalValue: -100,
              },
            ],
            totalReturn: 9.1,
            accountReturns: { DEMOREER: 9.1 },
          },
        },
      };
      window.__requests = [];
      const nativePostMessage = window.postMessage.bind(window);
      window.postMessage = (message, targetOrigin, transfer) => {
        if (message?.source === "manuvie-evolution-content") {
          window.__requests.push(message.detail.requestId);
        }
        try {
          return nativePostMessage(message, targetOrigin, transfer);
        } catch {
          return undefined;
        }
      };
      window.chrome = {
        storage: {
          local: {
            get: (key, callback) => callback({ [key]: cache }),
            set: (items, callback) => {
              window.__stored = items[cacheKey];
              callback?.();
            },
          },
        },
      };
    },
    { cachedDate, cachedYear, currentDate },
  );
  await page.addScriptTag({ path: path.resolve("src/content.js") });
  await page.evaluate(() => {
    window.postMessage({ source: "manuvie-evolution-page", type: "bridge-ready" }, "*");
    window.postMessage(
      {
        source: "manuvie-evolution-page",
        type: "api-response",
        detail: {
          url: "https://api.myinvestorportal.ca/portfoliosummary/account/v2/investorId/demo/language/fr",
          data: { accountList: [{ account: "DEMOREER", accountType: "REER" }] },
        },
      },
      "*",
    );
  });
  await expect(
    page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).resolves.toBe(false);
  await expect(page.getByRole("button", { name: "Ouvrir Manuvie Évolution" })).toContainText(
    "v0.2.21",
  );
  await page.getByRole("button", { name: "Ouvrir Manuvie Évolution" }).click();
  await expect(page.getByRole("heading", { name: "Gains de vos placements" })).toBeVisible();
  await expect(
    page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).resolves.toBe(false);
  await page.waitForFunction(() => window.__requests.includes("total:current"));
  const requests = await page.evaluate(() => window.__requests);
  expect(requests).toContain("account:DEMOREER:current");
  expect(requests).not.toContain(`total:return:${cachedYear}`);
  expect(requests).not.toContain(`transactions:${cachedYear}`);
});

test("shows detailed loading progress", async ({ page }) => {
  await page.setContent('<!doctype html><html lang="fr"><body></body></html>');
  await page.addStyleTag({ path: path.resolve("src/styles.css") });
  await page.addStyleTag({
    content: `#manuvie-evolution-extension .me-filter-menu label {
      min-height: 108px;
      padding: 28px 20px;
      font-size: 28px;
      align-items: flex-start;
    }
    #manuvie-evolution-extension .me-filter-menu input {
      margin-top: 16px;
      width: 24px;
      height: 24px;
    }`,
  });
  await page.addScriptTag({ path: path.resolve("src/analytics.js") });
  await page.addScriptTag({ path: path.resolve("src/content.js") });
  await page.evaluate(() => {
    const progress = (id, status, detail) =>
      window.postMessage(
        { source: "manuvie-evolution-page", type: "progress", detail: { id, status, detail } },
        "*",
      );
    progress("bridge", "done", "Pont principal initialisé");
    progress("activity", "done", "Réponse API reçue");
    progress("session", "done", "En-tête de session API détecté");
    progress("accounts", "active", "Traitement asynchrone demandé par Manuvie");
  });
  await page.getByRole("button", { name: "Ouvrir Manuvie Évolution" }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "67");
  await expect(page.getByText("Liste des comptes")).toBeVisible();
  await page.screenshot({ path: "test-results/manuvie-evolution-progress.png" });
});

test("renders the Manuvie Evolution dashboard", async ({ page }) => {
  await page.setContent(
    `<!doctype html><html lang="fr"><body style="margin:0;background:#eef3f5;font-family:Arial"><header style="height:110px;background:#fff;padding:30px 50px;font-size:34px">Gestion de patrimoine <b>Manuvie</b></header><main style="padding:50px"><h1>Bonjour!</h1><div style="display:flex;gap:24px"><div style="background:#00a758;color:#fff;padding:34px;width:260px"><b>Valeur marchande</b><h2>241 294,51 $</h2></div><div style="background:#003f5c;color:#fff;padding:34px;width:260px"><b>Solde de trésorerie</b><h2>-6,64 $</h2></div></div></main></body></html>`,
  );
  await page.addStyleTag({ path: path.resolve("src/styles.css") });
  await page.addScriptTag({ path: path.resolve("src/analytics.js") });
  await page.addScriptTag({ path: path.resolve("src/content.js") });

  const months = Array.from({ length: 33 }, (_, index) =>
    Date.UTC(2024 + Math.floor(index / 12), index % 12, 28),
  );
  const market = months.map((date, index) => [date, 135000 + index * 3200]);
  const capital = months.map((date, index) => [date, 130000 + index * 1200]);
  await page.evaluate(
    ({ market, capital }) => {
      window.postMessage({ source: "manuvie-evolution-page", type: "bridge-ready" }, "*");
      const dispatch = (url, data, requestId = null) =>
        window.postMessage(
          {
            source: "manuvie-evolution-page",
            type: "api-response",
            detail: { url, data, requestId },
          },
          "*",
        );
      dispatch(
        "https://api.myinvestorportal.ca/portfoliosummary/account/v2/investorId/demo/language/fr",
        {
          accountList: [
            { account: "DEMOREER", accountType: "REER" },
            { account: "DEMOCELI", accountType: "COMPTE D’ÉPARGNE LIBRE D’IMPÔT" },
            { account: "DEMOREEE", accountType: "REEE FAMILIAL" },
          ],
        },
      );
      dispatch(
        "https://api.myinvestorportal.ca/portfoliosummary/performance/v3/fr?rangeType=sinceInception",
        { marketValue: market, netInvestedCapital: capital },
      );
      for (const account of ["DEMOREER", "DEMOCELI", "DEMOREEE"])
        dispatch(
          `https://api.myinvestorportal.ca/account/chart/account/${account}/language/fr?rangeType=sinceInception`,
          {
            marketValue: market.map(([d, v]) => [d, v / 3]),
            netInvestedCapital: capital.map(([d, v]) => [d, v / 3]),
          },
          `account:${account}:all`,
        );
      for (const year of [2024, 2025, 2026]) {
        dispatch(
          "transactions",
          {
            transactionList: ["DEMOREER", "DEMOCELI", "DEMOREEE"].flatMap((accountNumber) => [
              {
                accountNumber,
                transactionType: "Frais De Programme À Honoraires",
                securityDescription: "PREMIER FEE",
                tradeDate: `15/06/${year}`,
                totalValue: -700,
              },
              {
                accountNumber,
                transactionType: "Tps",
                securityDescription: "GST",
                tradeDate: `15/06/${year}`,
                totalValue: -35,
              },
              {
                accountNumber,
                transactionType: "Taxe de vente du Québec",
                securityDescription: "QST",
                tradeDate: `15/06/${year}`,
                totalValue: -70,
              },
              {
                accountNumber,
                transactionType: "Cotisation",
                securityDescription:
                  accountNumber === "DEMOREER"
                    ? "YN5-6MAY-T BIWEEKLY PAC"
                    : accountNumber === "DEMOCELI"
                      ? "RBC BILL PAYMENT"
                      : "Dépôt annuel",
                tradeDate: `15/03/${year}`,
                totalValue: 1200,
              },
              {
                accountNumber,
                transactionType: "Cotisation",
                securityDescription: "Dépôt ponctuel",
                tradeDate: `20/07/${year}`,
                totalValue: 800,
              },
            ]),
          },
          `transactions:${year}`,
        );
        dispatch(
          "return",
          { performance: year === 2024 ? {} : { returnOnInvestment: 10 + year - 2024 } },
          `total:return:${year}`,
        );
        for (const account of ["DEMOREER", "DEMOCELI", "DEMOREEE"])
          dispatch(
            "return",
            { returnOnInvestment: 8 + year - 2024 },
            `account:${account}:return:${year}`,
          );
      }
    },
    { market, capital },
  );

  await expect(
    page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).resolves.toBe(false);
  await page.getByRole("button", { name: "Ouvrir Manuvie Évolution" }).click();
  await expect(page.getByRole("heading", { name: "Gains de vos placements" })).toBeVisible();
  await expect(
    page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).resolves.toBe(false);
  await expect(page.getByRole("tab", { name: "Ensemble des comptes" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "REER" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "CELI" })).toBeVisible();
  await expect(page.getByText("Valeur marchande").first()).toBeVisible();
  await expect(page.locator(".me-kpi-summary > small")).toHaveText(
    `Depuis le 1er janvier ${new Date().getFullYear()}`,
  );
  await expect(page.getByText("Cotisations").first()).toBeVisible();
  await expect(page.getByText("Gain").first()).toBeVisible();
  await expect(page.getByText("Frais").first()).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: `Cotisations depuis le 1er janvier ${new Date().getFullYear()}`,
    }),
  ).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Date" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Compte" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Détail" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Cotisation" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Cumul" })).toBeVisible();
  await expect(page.getByRole("cell", { name: /CELI/ }).first()).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Cotisation · RBC BILL PAYMENT" }).first(),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "1 200 $" }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "6 000 $" })).toBeVisible();
  await page.getByRole("button", { name: "Filtrer Compte" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.getByLabel("CELI").check();
  await expect(page.getByRole("button", { name: "Filtrer Compte" }).locator("b")).toHaveText("1");
  await expect(page.getByRole("cell", { name: "2 000 $" })).toBeVisible();
  await page.screenshot({ path: "test-results/manuvie-evolution-contribution-filter.png" });
  await page.getByRole("button", { name: "Filtrer Compte" }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.getByRole("button", { name: "Filtrer Détail" }).click();
  await expect(page.getByText("Cotisation · YN5-6MAY-T BIWEEKLY PAC")).toBeVisible();
  const filterOptionMetrics = await page
    .locator(".me-filter-menu label")
    .first()
    .evaluate((label) => {
      const input = label.querySelector("input").getBoundingClientRect();
      const text = label.querySelector("span").getBoundingClientRect();
      const box = label.getBoundingClientRect();
      return {
        height: box.height,
        inputTextCenterOffset: Math.abs(
          input.top + input.height / 2 - (text.top + text.height / 2),
        ),
      };
    });
  expect(filterOptionMetrics.height).toBeLessThan(30);
  expect(filterOptionMetrics.inputTextCenterOffset).toBeLessThan(3);
  await page.screenshot({ path: "test-results/manuvie-evolution-detail-filter.png" });
  await page.locator(".me-section-title").click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "REER" })).toHaveCSS(
    "background-color",
    "rgb(0, 118, 168)",
  );
  await expect(page.getByRole("tab", { name: "REER" })).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.locator(".me-section")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Frais et gains par année" })).toHaveCount(0);
  await expect(page.getByText("Rendement global non fourni par Manuvie")).toHaveCount(0);
  await expect(page.getByText(/Rendement estimé/).first()).toBeVisible();
  await expect(page.getByText(/Gains absorbés/).first()).toBeVisible();
  await page.getByRole("tab", { name: "CELI" }).click();
  await expect(page.getByRole("tab", { name: "CELI" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "CELI" })).toHaveCSS(
    "background-color",
    "rgb(235, 106, 25)",
  );
  await expect(page.getByRole("tab", { name: "CELI" })).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.getByRole("heading", { name: "CELI" })).toBeVisible();
  await expect(page.locator(".me-section-title strong")).toHaveCSS("color", "rgb(235, 106, 25)");
  await expect(page.locator(".me-kpi-summary")).toContainText(/[+-]?\d+,\d %/);
  const firstChart = page.locator(".me-chart").first();
  const box = await firstChart.boundingBox();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.45);
  await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.45);
  await expect(firstChart).toHaveCSS("outline-style", "none");
  await expect(firstChart.locator(".me-chart-hover")).toBeVisible();
  await expect(firstChart.locator(".me-tooltip-year-heading")).toContainText(
    /^Depuis le 1er janvier \d{4}$/,
  );
  await expect(firstChart.locator(".me-tooltip-heading")).toContainText("Total");
  await expect(firstChart.locator(".me-tooltip-year-gain")).toContainText("Gain");
  await expect(firstChart.locator(".me-tooltip-year-rate")).toContainText("Rendement");
  await expect(firstChart.locator(".me-tooltip-gain")).toContainText("Gain");
  await expect(firstChart.locator(".me-tooltip-rate")).toContainText("Rendement");
  const hoverTarget = async (target) =>
    firstChart.evaluate((chart, requestedTarget) => {
      const points = JSON.parse(decodeURIComponent(chart.dataset.points));
      const selected =
        requestedTarget === "first"
          ? points[0]
          : requestedTarget === "last"
            ? points.at(-1)
            : points.find((point) => point.x > 510);
      const svgPoint = chart.createSVGPoint();
      svgPoint.x = selected.x;
      svgPoint.y = selected.y;
      const screenPoint = svgPoint.matrixTransform(chart.getScreenCTM());
      return { clientX: screenPoint.x, clientY: screenPoint.y, expectedX: selected.x };
    }, target);
  for (const target of ["first", "last"]) {
    const edgeHoverPoint = await hoverTarget(target);
    await page.mouse.move(edgeHoverPoint.clientX, edgeHoverPoint.clientY);
    await expect(
      firstChart
        .locator(".me-chart-hover-point")
        .evaluate((element) => Number(element.getAttribute("cx"))),
    ).resolves.toBe(edgeHoverPoint.expectedX);
    const pointOffset = await firstChart.evaluate((chart, expectedClientX) => {
      const circle = chart.querySelector(".me-chart-hover-point").getBoundingClientRect();
      return Math.abs(expectedClientX - (circle.left + circle.width / 2));
    }, edgeHoverPoint.clientX);
    expect(pointOffset).toBeLessThan(1);
  }
  const rightHoverPoint = await hoverTarget("right");
  await page.mouse.move(rightHoverPoint.clientX, rightHoverPoint.clientY);
  await expect(
    firstChart
      .locator(".me-chart-hover-point")
      .evaluate((element) => Number(element.getAttribute("cx"))),
  ).resolves.toBe(rightHoverPoint.expectedX);
  await expect(
    firstChart
      .locator(".me-chart-hover")
      .evaluate((element) => getComputedStyle(element).pointerEvents),
  ).resolves.toBe("none");
  await expect(
    page.locator(".me-panel").evaluate((element) => element.scrollHeight <= element.clientHeight),
  ).resolves.toBe(true);
  await page.screenshot({ path: "test-results/manuvie-evolution-desktop.png", fullPage: true });
});
