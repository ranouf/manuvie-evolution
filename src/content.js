(() => {
  "use strict";

  const analytics = globalThis.ManuvieAnalytics;
  const PAGE_SOURCE = "manuvie-evolution-page";
  const CONTENT_SOURCE = "manuvie-evolution-content";
  const API_ORIGIN = "https://api.myinvestorportal.ca";
  const extensionVersion = globalThis.chrome?.runtime?.getManifest?.().version ?? "0.2.20";
  const money = new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });
  const preciseMoney = new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const percent = new Intl.NumberFormat("fr-CA", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  });
  const shortDate = new Intl.DateTimeFormat("fr-CA", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const progressSteps = [
    ["extension", "Extension Chrome injectée"],
    ["bridge", "Pont avec la page Manuvie"],
    ["activity", "Appels API du portail"],
    ["session", "Session API authentifiée"],
    ["accounts", "Liste des comptes"],
    ["performance", "Historique du portefeuille"],
  ];
  const currentYear = () => new Date().getFullYear();
  const storageKey = () => `manuvie-evolution:v1:${state.investorId}`;
  const canStore = () => Boolean(globalThis.chrome?.storage?.local && state.investorId);
  const state = {
    accounts: null,
    total: null,
    accountCharts: new Map(),
    returns: new Map(),
    transactions: new Map(),
    requested: new Set(),
    cache: null,
    cacheLoaded: false,
    errors: [],
    investorId: null,
    activeTab: "total",
    contributionFilterOpen: null,
    contributionFilters: {},
    bridgeReady: false,
    open: false,
    progress: new Map([
      ["extension", { status: "done", detail: "Scripts de l’extension chargés" }],
      ["bridge", { status: "active", detail: "Connexion au contexte principal…" }],
    ]),
  };

  let root;
  let panel;

  const storageGet = async () => {
    if (!canStore()) return null;
    return new Promise((resolve) => {
      chrome.storage.local.get(storageKey(), (items) => resolve(items[storageKey()] ?? null));
    });
  };

  const storageSet = async (value) => {
    if (!canStore()) return;
    await new Promise((resolve) => chrome.storage.local.set({ [storageKey()]: value }, resolve));
  };

  const setProgress = (id, status, detail) => {
    state.progress.set(id, { status, detail });
    render();
  };

  const request = (url, requestId) => {
    if (state.requested.has(requestId)) return;
    state.requested.add(requestId);
    window.postMessage(
      { source: CONTENT_SOURCE, type: "api-request", detail: { url, requestId } },
      location.origin,
    );
  };

  const accountList = () => state.accounts?.accountList ?? [];
  const accountLabel = (account) => {
    const type = account.accountType.toUpperCase();
    if (type.includes("ÉPARGNE-ÉTUDES") || type.includes("REEE")) return "REEE";
    if (type.includes("LIBRE D’IMPÔT") || type.includes("CELI")) return "CELI";
    if (type.includes("REER")) return "REER";
    return type;
  };

  const accountTabLabel = (account) => {
    const label = accountLabel(account);
    return label.length > 18 ? `${label.slice(0, 16)}…` : label;
  };

  const monthRange = (year) => {
    const now = new Date();
    const lastMonth = year === currentYear() ? now.getMonth() + 1 : 12;
    return `${year}01${year}${String(lastMonth).padStart(2, "0")}`;
  };

  const loadCache = async () => {
    if (!canStore() || state.cacheLoaded) return;
    state.cacheLoaded = true;
    state.cache = await storageGet();
    if (!state.cache) return;
    if (state.cache.accounts) {
      state.accounts = state.cache.accounts;
      setProgress("accounts", "done", `${accountList().length} compte(s) en cache`);
    }
    if (state.cache.total) {
      state.total = state.cache.total;
      setProgress("performance", "done", "Historique récupéré du cache");
    }
    for (const [account, chart] of Object.entries(state.cache.accountCharts ?? {})) {
      state.accountCharts.set(account, chart);
    }
    const archivedYears = Object.entries(state.cache.years ?? {}).filter(
      ([year]) => Number(year) < currentYear(),
    );
    for (const [year, item] of archivedYears) {
      state.transactions.set(Number(year), item.transactions ?? []);
      state.returns.set(`total:return:${year}`, item.totalReturn ?? null);
      for (const [account, roi] of Object.entries(item.accountReturns ?? {})) {
        state.returns.set(`account:${account}:return:${year}`, roi ?? null);
      }
    }
    render();
    requestDetails();
  };

  const saveCache = () => {
    if (!canStore()) return;
    const years = { ...(state.cache?.years ?? {}) };
    for (const [year, transactions] of state.transactions) {
      years[year] ??= {};
      years[year].transactions = transactions;
    }
    for (const [key, roi] of state.returns) {
      const match = key.match(/^(account:([^:]+)|total):return:(\d{4})$/);
      if (!match) continue;
      const year = match[3];
      years[year] ??= {};
      if (match[2]) {
        years[year].accountReturns ??= {};
        years[year].accountReturns[match[2]] = roi;
      } else {
        years[year].totalReturn = roi;
      }
    }
    const accountCharts = Object.fromEntries(state.accountCharts);
    const nextCache = {
      version: 1,
      updatedAt: new Date().toISOString(),
      accounts: state.accounts,
      total: state.total,
      accountCharts,
      years,
    };
    state.cache = nextCache;
    void storageSet(nextCache);
  };

  const dayRange = (year) => {
    const now = new Date();
    const end = year === now.getFullYear() ? now : new Date(Date.UTC(year, 11, 31));
    const format = (date) =>
      `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
    return `${year}0101${format(end)}`;
  };

  const requestDetails = () => {
    if (!state.bridgeReady || !state.investorId) return;
    if (!state.total) {
      request(
        `${API_ORIGIN}/portfoliosummary/performance/v3/fr?rangeType=sinceInception`,
        "total:all",
      );
      return;
    }
    if (!state.accounts) return;
    if (state.cache?.total) {
      request(
        `${API_ORIGIN}/portfoliosummary/performance/v3/fr?rangeType=${monthRange(currentYear())}`,
        "total:current",
      );
    }
    const firstTimestamp = analytics.normalizeSeries(state.total.marketValue)[0]?.[0];
    const firstYear = firstTimestamp
      ? new Date(firstTimestamp).getUTCFullYear()
      : new Date().getFullYear();
    const year = currentYear();
    const years = Array.from({ length: year - firstYear + 1 }, (_, index) => firstYear + index);

    for (const account of accountList()) {
      request(
        `${API_ORIGIN}/account/chart/account/${account.account}/language/fr?rangeType=${state.accountCharts.has(account.account) ? monthRange(year) : "sinceInception"}`,
        `account:${account.account}:${state.accountCharts.has(account.account) ? "current" : "all"}`,
      );
      for (const year of years) {
        if (year < currentYear() && state.cache?.years?.[year]) continue;
        request(
          `${API_ORIGIN}/account/chart/account/${account.account}/language/fr?rangeType=${monthRange(year)}`,
          `account:${account.account}:return:${year}`,
        );
      }
    }
    for (const year of years) {
      if (year < currentYear() && state.cache?.years?.[year]) continue;
      request(
        `${API_ORIGIN}/portfoliosummary/performance/v3/fr?rangeType=${monthRange(year)}`,
        `total:return:${year}`,
      );
      request(
        `${API_ORIGIN}/transactions/investorId/${state.investorId}/language/fr?rangeType=${dayRange(year)}&pageOrigin=transactions`,
        `transactions:${year}`,
      );
    }
  };

  const readInvestorId = (url) => {
    const match = url.match(/\/investorId\/([^/]+)/);
    if (!match || state.investorId === match[1]) return;
    state.investorId = match[1];
    void loadCache();
  };

  const onResponse = (detail) => {
    const { url, data, requestId } = detail ?? {};
    if (!url || !data) return;
    readInvestorId(url);
    if (data.__manuvieError) {
      state.errors.push(data.__manuvieError);
      setProgress("activity", "error", data.__manuvieError);
      render();
      return;
    }
    if (requestId === "total:all") {
      state.total = data;
      setProgress("performance", "done", "Historique reçu par l’extension");
    } else if (requestId === "total:current") {
      state.total = analytics.mergeChartData(state.total, data);
      setProgress("performance", "done", "Année courante rafraîchie");
    } else if (requestId?.startsWith("account:") && requestId.includes(":return:")) {
      state.returns.set(requestId, data.returnOnInvestment);
    } else if (requestId?.startsWith("account:") && requestId.endsWith(":current")) {
      const account = requestId.split(":")[1];
      state.accountCharts.set(
        account,
        analytics.mergeChartData(state.accountCharts.get(account), data),
      );
    } else if (requestId?.startsWith("account:") && requestId.endsWith(":all")) {
      state.accountCharts.set(requestId.split(":")[1], data);
    } else if (requestId?.startsWith("total:return:")) {
      state.returns.set(
        requestId,
        data.performance?.returnOnInvestment ?? data.returnOnInvestment ?? null,
      );
    } else if (requestId?.startsWith("transactions:")) {
      state.transactions.set(Number(requestId.split(":")[1]), data.transactionList ?? []);
    } else if (/\/portfoliosummary\/account\/v2\//.test(url)) {
      state.accounts = data;
      setProgress("accounts", "done", `${accountList().length} compte(s) reçu(s)`);
    } else if (/\/portfoliosummary\/performance\/v3\//.test(url) && /sinceInception/.test(url)) {
      state.total = data;
      setProgress("performance", "done", "Valeur marchande et capital net reçus");
    }
    if (state.accounts && state.total) saveCache();
    requestDetails();
    render();
  };

  const svgChart = (marketValue, netInvestedCapital, color) => {
    const market = new Map(analytics.normalizeSeries(marketValue));
    const capital = new Map(analytics.normalizeSeries(netInvestedCapital));
    const points = analytics.gainSeries(marketValue, netInvestedCapital).map(([date, gain]) => ({
      date,
      gain,
      capital: capital.get(date) ?? 0,
      market: market.get(date) ?? 0,
      rate: capital.get(date) ? (gain / capital.get(date)) * 100 : 0,
    }));
    if (points.length < 2) return '<p class="me-empty">Données mensuelles indisponibles.</p>';
    const width = 720;
    const height = 210;
    const margin = { left: 54, right: 16, top: 16, bottom: 32 };
    const values = points.map(({ gain }) => gain);
    const min = Math.min(0, ...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const x = (index) =>
      margin.left + (index / (points.length - 1)) * (width - margin.left - margin.right);
    const y = (value) =>
      margin.top + ((max - value) / span) * (height - margin.top - margin.bottom);
    const path = points
      .map(({ gain }, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(gain).toFixed(1)}`)
      .join(" ");
    const ticks = [0, 0.5, 1].map((ratio) => {
      const value = max - span * ratio;
      const py = y(value);
      return `<line x1="${margin.left}" x2="${width - margin.right}" y1="${py}" y2="${py}" class="me-grid"/><text x="${margin.left - 8}" y="${py + 4}" text-anchor="end">${Math.round(value / 1000)} k$</text>`;
    });
    const hoverPoints = points.map((point, index) => {
      const yearStart = Date.UTC(new Date(point.date).getUTCFullYear(), 0, 1);
      const baseline =
        points.slice(0, index).findLast((item) => new Date(item.date).getTime() < yearStart) ??
        points[0];
      const yearGain = point.gain - baseline.gain;
      const yearRate = baseline.capital ? (yearGain / baseline.capital) * 100 : 0;
      return {
        ...point,
        yearGain,
        yearRate,
        x: Number(x(index).toFixed(1)),
        y: Number(y(point.gain).toFixed(1)),
      };
    });
    const first = new Date(points[0].date);
    const last = new Date(points.at(-1).date);
    return `<svg class="me-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Évolution des gains de ${money.format(points[0].gain)} à ${money.format(points.at(-1).gain)}" data-points="${encodeURIComponent(JSON.stringify(hoverPoints))}">
      ${ticks.join("")}
      <path d="${path}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>
      <g class="me-chart-hover" hidden>
        <line class="me-chart-hover-line" y1="${margin.top}" y2="${height - margin.bottom}"/>
        <circle class="me-chart-hover-point" r="6" fill="${color}"/>
        <g class="me-chart-tooltip">
          <rect width="210" height="158" rx="4"/>
          <text class="me-tooltip-date" x="10" y="20"></text>
          <text class="me-tooltip-year-heading" x="10" y="42"></text>
          <text class="me-tooltip-year-gain" x="10" y="62"></text>
          <text class="me-tooltip-year-rate" x="10" y="82"></text>
          <text class="me-tooltip-heading" x="10" y="104">Total</text>
          <text class="me-tooltip-gain" x="10" y="124"></text>
          <text class="me-tooltip-rate" x="10" y="144"></text>
        </g>
      </g>
      <rect class="me-chart-hitbox" x="${margin.left}" y="${margin.top}" width="${width - margin.left - margin.right}" height="${height - margin.top - margin.bottom}"/>
      <circle cx="${x(points.length - 1)}" cy="${y(points.at(-1).gain)}" r="5" fill="${color}"/>
      <text x="${margin.left}" y="${height - 8}">${first.toLocaleDateString("fr-CA", { month: "short", year: "numeric", timeZone: "UTC" })}</text>
      <text x="${width - margin.right}" y="${height - 8}" text-anchor="end">${last.toLocaleDateString("fr-CA", { month: "short", year: "numeric", timeZone: "UTC" })}</text>
    </svg>`;
  };

  const setupChartHover = () => {
    panel.querySelectorAll(".me-chart").forEach((chart) => {
      const points = JSON.parse(decodeURIComponent(chart.dataset.points ?? "[]"));
      if (!points.length) return;
      const hover = chart.querySelector(".me-chart-hover");
      const line = chart.querySelector(".me-chart-hover-line");
      const point = chart.querySelector(".me-chart-hover-point");
      const tooltip = chart.querySelector(".me-chart-tooltip");
      const tooltipDate = chart.querySelector(".me-tooltip-date");
      const tooltipYearHeading = chart.querySelector(".me-tooltip-year-heading");
      const tooltipYearGain = chart.querySelector(".me-tooltip-year-gain");
      const tooltipYearRate = chart.querySelector(".me-tooltip-year-rate");
      const tooltipGain = chart.querySelector(".me-tooltip-gain");
      const tooltipRate = chart.querySelector(".me-tooltip-rate");
      const chartPoint = chart.createSVGPoint();
      const clientToViewX = (clientX, clientY) => {
        chartPoint.x = clientX;
        chartPoint.y = clientY;
        return chartPoint.matrixTransform(chart.getScreenCTM().inverse()).x;
      };
      const showPoint = (clientX, clientY) => {
        const viewX = clientToViewX(clientX, clientY);
        const selected = points.reduce((closest, item) =>
          Math.abs(item.x - viewX) < Math.abs(closest.x - viewX) ? item : closest,
        );
        const tooltipX = selected.x > 494 ? selected.x - 218 : selected.x + 12;
        const tooltipY = Math.max(12, Math.min(40, selected.y - 79));
        hover.removeAttribute("hidden");
        line.setAttribute("x1", selected.x);
        line.setAttribute("x2", selected.x);
        point.setAttribute("cx", selected.x);
        point.setAttribute("cy", selected.y);
        tooltip.setAttribute("transform", `translate(${tooltipX} ${tooltipY})`);
        tooltipDate.textContent = new Date(selected.date).toLocaleDateString("fr-CA", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        });
        tooltipYearHeading.textContent = `Depuis le 1er janvier ${new Date(selected.date).getUTCFullYear()}`;
        tooltipYearGain.textContent = `Gain ${money.format(selected.yearGain)}`;
        tooltipYearRate.textContent = `Rendement ${percent.format(selected.yearRate)} %`;
        tooltipGain.textContent = `Gain ${money.format(selected.gain)}`;
        tooltipRate.textContent = `Rendement ${percent.format(selected.rate)} %`;
      };
      chart.addEventListener("pointermove", (event) => showPoint(event.clientX, event.clientY));
      chart.addEventListener("pointerleave", () => {
        hover.setAttribute("hidden", "");
      });
      chart.addEventListener("focus", () => {
        const box = chart.getBoundingClientRect();
        showPoint(box.right, box.top + box.height / 2);
      });
      chart.addEventListener("blur", () => {
        hover.setAttribute("hidden", "");
      });
      chart.tabIndex = 0;
    });
  };

  const yearlyCards = (key, gains, returns, fees) =>
    Object.entries(gains)
      .filter(([year]) => Number(year) >= 2024)
      .map(([year, gain]) => {
        const apiRoi = state.returns.get(`${key}:return:${year}`);
        const roi = apiRoi ?? returns[year];
        const fee = fees[year];
        const roiLabel =
          apiRoi === undefined && returns[year] === undefined
            ? "Rendement en chargement"
            : `Rendement estimé ${percent.format(Number(roi))} %`;
        const feeLabel = state.transactions.has(Number(year))
          ? `<small class="me-year-fees">Frais ${preciseMoney.format(fee?.total ?? 0)}<span>Taux annuel ${percent.format(fee?.annualRate ?? 0)} %</span><span>Gains absorbés ${percent.format(fee?.absorbed ?? 0)} %</span></small>`
          : '<small class="me-year-fees">Frais en chargement</small>';
        return `<div class="me-year"><b>${year}${Number(year) === new Date().getFullYear() ? " à ce jour" : ""}</b><span>Gain ${money.format(gain)}</span><small>${roiLabel}</small>${feeLabel}</div>`;
      })
      .join("");

  const currentYearBaseline = (series) => {
    const points = analytics.normalizeSeries(series);
    const yearStart = Date.UTC(currentYear(), 0, 1);
    return points.findLast(([date]) => date < yearStart)?.[1] ?? points[0]?.[1] ?? 0;
  };

  const yearlyKpis = (data, fees, contributions, color) => {
    const market = analytics.normalizeSeries(data.marketValue);
    const capital = analytics.normalizeSeries(data.netInvestedCapital);
    const gains = analytics.gainSeries(data.marketValue, data.netInvestedCapital);
    const currentMarket = market.at(-1)?.[1] ?? 0;
    const currentGain = gains.at(-1)?.[1] ?? 0;
    const capitalBaseline = currentYearBaseline(capital);
    const gainThisYear = currentGain - currentYearBaseline(gains);
    const gainThisYearRate = capitalBaseline ? (gainThisYear / capitalBaseline) * 100 : 0;
    const currentFees = fees[currentYear()]?.total ?? 0;
    const currentContributions = contributions[currentYear()]?.total ?? 0;
    return `<div class="me-kpis" style="--me-kpi-color:${color}">
      <article class="me-kpi me-kpi-primary"><small>Valeur marchande</small><strong>${money.format(currentMarket)}</strong></article>
      <article class="me-kpi me-kpi-summary"><small>Depuis le 1er janvier ${currentYear()}</small><div>
        <span><em>Cotisations</em><strong>${money.format(currentContributions)}</strong></span>
        <span><em>Gain</em><strong>${money.format(gainThisYear)}</strong><b>${percent.format(gainThisYearRate)} %</b></span>
        <span><em>Frais</em><strong>${preciseMoney.format(currentFees)}</strong></span>
      </div></article>
    </div>`;
  };

  const accountNameByNumber = () =>
    new Map(accountList().map((account) => [String(account.account), accountLabel(account)]));

  const currentContributionFilters = (tabKey) => {
    state.contributionFilters[tabKey] ??= { account: [], detail: [] };
    return state.contributionFilters[tabKey];
  };

  const contributionFilterButton = (tabKey, filterKey, label, options) => {
    const selected = currentContributionFilters(tabKey)[filterKey];
    const isOpen = state.contributionFilterOpen === `${tabKey}:${filterKey}`;
    const optionItems = options
      .map((option) => {
        const checked = selected.includes(option);
        return `<label><input type="checkbox" data-filter="${filterKey}" data-value="${encodeURIComponent(option)}" ${checked ? "checked" : ""}><span>${option}</span></label>`;
      })
      .join("");
    return `<span class="me-filterable-heading"><span>${label}</span><button class="me-filter-button" type="button" aria-label="Filtrer ${label}" aria-expanded="${isOpen}" data-filter="${filterKey}"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 6h16l-6 7v5l-4 2v-7z"/></svg>${selected.length ? `<b>${selected.length}</b>` : ""}</button>${isOpen ? `<span class="me-filter-menu me-filter-menu-${filterKey}" role="menu">${optionItems}</span>` : ""}</span>`;
  };

  const contributionTable = (tabKey, transactions, color) => {
    const accountNames = accountNameByNumber();
    const filters = currentContributionFilters(tabKey);
    const contributions = analytics
      .listContributions(transactions)
      .filter(({ timestamp }) => new Date(timestamp).getUTCFullYear() === currentYear())
      .map((contribution) => {
        const accountName =
          accountNames.get(String(contribution.accountNumber)) ?? contribution.accountNumber ?? "—";
        const detail =
          [contribution.transactionType, contribution.securityDescription]
            .filter(Boolean)
            .join(" · ") || "—";
        return { ...contribution, accountName, detail };
      });
    if (!contributions.length) return "";
    const accountOptions = [...new Set(contributions.map(({ accountName }) => accountName))];
    const detailOptions = [...new Set(contributions.map(({ detail }) => detail))];
    const visibleContributions = contributions.filter(
      ({ accountName, detail }) =>
        (!filters.account.length || filters.account.includes(accountName)) &&
        (!filters.detail.length || filters.detail.includes(detail)),
    );
    let cumulative = 0;
    const rows = visibleContributions
      .map((contribution) => {
        cumulative += contribution.amount;
        return `<tr><td>${shortDate.format(contribution.timestamp)}</td><td>${contribution.accountName}<small>${contribution.accountNumber ?? ""}</small></td><td>${contribution.detail}</td><td>${money.format(contribution.amount)}</td><td>${money.format(cumulative)}</td></tr>`;
      })
      .join("");
    const activeTotal = filters.account.length + filters.detail.length;
    return `<section class="me-contributions" style="--me-contribution-color:${color}">
      <div class="me-contributions-title"><h4>Cotisations depuis le 1er janvier ${currentYear()}${activeTotal ? ` · ${visibleContributions.length}/${contributions.length} affichée(s)` : ""}</h4><strong>${money.format(cumulative)}</strong></div>
      <div class="me-table-wrap"><table>
        <thead><tr><th>Date</th><th>${contributionFilterButton(tabKey, "account", "Compte", accountOptions)}</th><th>${contributionFilterButton(tabKey, "detail", "Détail", detailOptions)}</th><th>Cotisation</th><th>Cumul</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5">Aucune cotisation ne correspond aux filtres.</td></tr>'}</tbody>
      </table></div>
    </section>`;
  };

  const chartSection = (title, key, data, color) => {
    const gains = analytics.gainSeries(data.marketValue, data.netInvestedCapital);
    const current = gains.at(-1)?.[1] ?? 0;
    const accountNumber = key === "total" ? null : key.split(":")[1];
    const transactions = analytics.transactionsForAccount(
      [...state.transactions.values()].flat(),
      accountNumber,
    );
    const fees = analytics.feeMetrics(
      analytics.aggregateFees(transactions),
      analytics.yearlyGains(gains),
      analytics.averageMarketValueByYear(data.marketValue),
    );
    const contributions = analytics.aggregateContributions(transactions);
    const returns = analytics.yearlyReturnRates(
      analytics.yearlyGains(gains),
      analytics.averageMarketValueByYear(data.marketValue),
    );
    return `<section class="me-section">
      ${yearlyKpis(data, fees, contributions, color)}
      <div class="me-section-title" style="--me-section-color:${color}"><h3>${title}</h3><strong>${money.format(current)}</strong></div>
      ${svgChart(data.marketValue, data.netInvestedCapital, color)}
      <div class="me-years">${yearlyCards(key, analytics.yearlyGains(gains), returns, fees)}</div>
      ${contributionTable(key, transactions, color)}
    </section>`;
  };

  const availableTabs = () => {
    const tabs = [
      { key: "total", label: "Ensemble des comptes", data: state.total, color: "#00a758" },
    ];
    const colors = ["#0076a8", "#eb6a19", "#6750a4", "#455a64"];
    accountList().forEach((account, index) => {
      const data = state.accountCharts.get(account.account);
      if (!data) return;
      tabs.push({
        key: `account:${account.account}`,
        label: accountTabLabel(account),
        title: accountLabel(account),
        data,
        color: colors[index % colors.length],
      });
    });
    return tabs;
  };

  const dashboard = () => {
    const tabs = availableTabs();
    const selected = tabs.find((tab) => tab.key === state.activeTab) ?? tabs[0];
    state.activeTab = selected.key;
    const tabButtons = tabs
      .map(
        (tab) =>
          `<button class="me-tab" role="tab" aria-selected="${tab.key === selected.key}" data-tab="${tab.key}" style="--me-tab-color:${tab.color};background-color:${tab.color};border-color:${tab.color};color:white">${tab.label}</button>`,
      )
      .join("");
    return `<div class="me-tabs" role="tablist" aria-label="Comptes Manuvie">${tabButtons}</div>
      ${chartSection(selected.title ?? selected.label, selected.key, selected.data, selected.color)}`;
  };

  const setupContributionFilters = () => {
    panel.addEventListener("click", (event) => {
      if (!state.contributionFilterOpen || event.target.closest(".me-filterable-heading")) return;
      state.contributionFilterOpen = null;
      render();
    });
    panel.querySelectorAll(".me-filter-button").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const filterKey = button.dataset.filter;
        const menuKey = `${state.activeTab}:${filterKey}`;
        state.contributionFilterOpen = state.contributionFilterOpen === menuKey ? null : menuKey;
        render();
      });
    });
    panel.querySelectorAll(".me-filter-menu input").forEach((input) => {
      input.addEventListener("change", (event) => {
        event.stopPropagation();
        const filters = currentContributionFilters(state.activeTab);
        const filterKey = input.dataset.filter;
        const value = decodeURIComponent(input.dataset.value);
        filters[filterKey] = input.checked
          ? [...filters[filterKey], value]
          : filters[filterKey].filter((item) => item !== value);
        render();
      });
    });
  };

  const render = () => {
    if (!panel) return;
    panel.hidden = !state.open;
    if (!state.open) return;
    if (!state.total || !state.accounts) {
      const steps = progressSteps.map(([id, label]) => {
        const item = state.progress.get(id) ?? {
          status: "pending",
          detail: "En attente",
        };
        const icon = item.status === "done" ? "✓" : item.status === "error" ? "!" : "";
        return `<li class="me-progress-step me-${item.status}"><span>${icon}</span><div><b>${label}</b><small>${item.detail}</small></div></li>`;
      });
      const completed = progressSteps.filter(
        ([id]) => state.progress.get(id)?.status === "done",
      ).length;
      const progress = Math.round((completed / progressSteps.length) * 100);
      panel.innerHTML = `<header><div><small>MANUVIE ÉVOLUTION</small><h2>Analyse des placements</h2></div><button class="me-close" aria-label="Fermer">×</button></header><main class="me-loading"><h3>Lecture des données du portail</h3><p>${progress} % terminé</p><div class="me-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></div><ol>${steps.join("")}</ol>${state.errors.length ? `<p class="me-progress-error">${state.errors.at(-1)}</p>` : ""}<p class="me-loading-help">Les étapes restent visibles pour identifier précisément un appel bloqué.</p></main>`;
      panel.querySelector(".me-close").addEventListener("click", toggle);
      return;
    }
    panel.innerHTML = `<header><div><small>MANUVIE ÉVOLUTION</small><h2>Gains de vos placements</h2></div><button class="me-close" aria-label="Fermer">×</button></header>
      <main>${dashboard()}</main>`;
    panel.querySelector(".me-close").addEventListener("click", toggle);
    panel.querySelectorAll(".me-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        state.activeTab = tab.dataset.tab;
        state.contributionFilterOpen = null;
        render();
      });
    });
    setupContributionFilters();
    setupChartHover();
  };

  function toggle() {
    state.open = !state.open;
    root.classList.toggle("me-open", state.open);
    render();
  }

  const mount = () => {
    if (document.getElementById("manuvie-evolution-extension")) return;
    document.documentElement.classList.add("manuvie-evolution-no-horizontal-scroll");
    root = document.createElement("div");
    root.id = "manuvie-evolution-extension";
    root.innerHTML = `<button class="me-launch" aria-label="Ouvrir Manuvie Évolution"><span class="me-launch-line"><span aria-hidden="true">↗</span><strong>Évolution</strong></span><small>v${extensionVersion}</small></button><aside class="me-panel" hidden></aside>`;
    document.body.append(root);
    panel = root.querySelector(".me-panel");
    root.querySelector(".me-launch").addEventListener("click", toggle);
    render();
  };

  window.addEventListener("message", (event) => {
    if (
      event.source !== window ||
      event.origin !== location.origin ||
      event.data?.source !== PAGE_SOURCE
    )
      return;
    if (event.data.type === "api-response") onResponse(event.data.detail);
    if (event.data.type === "progress") {
      const { id, status, detail } = event.data.detail;
      setProgress(id, status, detail);
    }
    if (event.data.type === "bridge-ready") {
      state.bridgeReady = true;
      setProgress("session", "done", "En-tête de session API détecté");
      requestDetails();
    }
  });
  document.addEventListener("DOMContentLoaded", mount, { once: true });
  if (document.readyState !== "loading") mount();
  window.postMessage({ source: CONTENT_SOURCE, type: "sync" }, location.origin);
})();
