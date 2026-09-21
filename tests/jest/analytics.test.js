const analytics = require("../../src/analytics.js");

describe("analytics", () => {
  const jan2024 = Date.UTC(2024, 0, 31);
  const dec2024 = Date.UTC(2024, 11, 31);
  const jan2025 = Date.UTC(2025, 0, 31);

  test("normalizes tuples and Highcharts points", () => {
    expect(analytics.normalizeSeries([[jan2024, 100], { x: dec2024, y: 150 }])).toEqual([
      [jan2024, 100],
      [dec2024, 150],
    ]);
    expect(analytics.normalizeSeries(null)).toEqual([]);
  });

  test("computes cumulative gains and annual changes", () => {
    const gains = analytics.gainSeries(
      [
        [jan2024, 100],
        [dec2024, 160],
        [jan2025, 190],
      ],
      [
        [jan2024, 80],
        [dec2024, 100],
        [jan2025, 110],
      ],
    );
    expect(gains).toEqual([
      [jan2024, 20],
      [dec2024, 60],
      [jan2025, 80],
    ]);
    expect(analytics.yearlyGains(gains)).toEqual({ 2024: 60, 2025: 20 });
  });

  test("merges refreshed chart points without losing history", () => {
    const merged = analytics.mergeChartData(
      {
        marketValue: [
          [jan2024, 100],
          [dec2024, 160],
        ],
        netInvestedCapital: [
          [jan2024, 80],
          [dec2024, 100],
        ],
      },
      {
        marketValue: [
          [dec2024, 170],
          [jan2025, 190],
        ],
        netInvestedCapital: [
          [dec2024, 110],
          [jan2025, 120],
        ],
      },
    );
    expect(merged.marketValue).toEqual([
      [jan2024, 100],
      [dec2024, 170],
      [jan2025, 190],
    ]);
    expect(merged.netInvestedCapital).toEqual([
      [jan2024, 80],
      [dec2024, 110],
      [jan2025, 120],
    ]);
  });

  test("computes average market value per year", () => {
    expect(
      analytics.averageMarketValueByYear([
        [jan2024, 100],
        [dec2024, 200],
        [jan2025, 300],
      ]),
    ).toEqual({
      2024: { average: 150, months: 2 },
      2025: { average: 300, months: 1 },
    });
  });

  test("computes estimated annual return rates", () => {
    expect(
      analytics.yearlyReturnRates({ 2024: 900 }, { 2024: { average: 10000, months: 6 } }),
    ).toEqual({ 2024: 18 });
    expect(analytics.yearlyReturnRates({ 2025: 100 }, {})).toEqual({ 2025: 0 });
  });

  test("classifies and aggregates Manuvie, GST and QST fees", () => {
    const transactions = [
      {
        transactionType: "Frais De Programme À Honoraires",
        securityDescription: "PREMIER FEE",
        tradeDate: "15/01/2024",
        totalValue: -100,
      },
      {
        transactionType: "Tps",
        securityDescription: "GST",
        tradeDate: "15/01/2024",
        totalValue: -5,
      },
      {
        transactionType: "Taxe de vente du Québec",
        securityDescription: "QST",
        tradeDate: "15/01/2024",
        totalValue: -10,
      },
      {
        transactionType: "Achat",
        securityDescription: "ETF",
        tradeDate: "16/01/2024",
        totalValue: -200,
      },
    ];
    expect(analytics.feeCategory(transactions[0])).toBe("manulife");
    expect(analytics.feeCategory(transactions[1])).toBe("gst");
    expect(analytics.feeCategory(transactions[2])).toBe("qst");
    expect(analytics.feeCategory(transactions[3])).toBeNull();
    expect(analytics.feeCategory({})).toBeNull();
    expect(analytics.aggregateFees(transactions)).toEqual({
      2024: { manulife: 100, gst: 5, qst: 10, total: 115 },
    });
  });

  test("aggregates contributions without counting purchases or fees", () => {
    const transactions = [
      {
        transactionType: "Cotisation",
        securityDescription: "CELI",
        tradeDate: "15/01/2026",
        totalValue: 1200,
      },
      {
        transactionType: "Achat",
        securityDescription: "ETF",
        tradeDate: "16/01/2026",
        totalValue: -1200,
      },
      {
        transactionType: "Frais De Programme À Honoraires",
        securityDescription: "PREMIER FEE",
        tradeDate: "17/01/2026",
        totalValue: -100,
      },
    ];
    expect(analytics.contributionCategory(transactions[0])).toBe("contribution");
    expect(analytics.contributionCategory(transactions[1])).toBeNull();
    expect(analytics.contributionCategory({})).toBeNull();
    expect(analytics.aggregateContributions(transactions)).toEqual({ 2026: { total: 1200 } });
    expect(analytics.listContributions(transactions)).toEqual([
      {
        accountNumber: undefined,
        amount: 1200,
        securityDescription: "CELI",
        timestamp: Date.UTC(2026, 0, 15),
        transactionType: "Cotisation",
      },
    ]);
    expect(
      analytics.aggregateContributions([
        {
          transactionType: "Dépôt",
          securityDescription: "",
          tradeDate: "01/02/2026",
          totalValue: -50,
        },
      ]),
    ).toEqual({});
  });

  test("computes fee rate and share of gains", () => {
    const metrics = analytics.feeMetrics(
      { 2024: { manulife: 80, gst: 5, qst: 15, total: 100 } },
      { 2024: 900 },
      { 2024: { average: 10000, months: 6 } },
    );
    expect(metrics[2024]).toMatchObject({
      gainAfterFees: 900,
      gainBeforeFees: 1000,
      annualRate: 2,
      absorbed: 10,
      months: 6,
    });
  });

  test("filters transactions for one account", () => {
    const transactions = [
      { accountNumber: "REER", totalValue: -100 },
      { accountNumber: "CELI", totalValue: -50 },
    ];
    expect(analytics.transactionsForAccount(transactions, "REER")).toEqual([transactions[0]]);
    expect(analytics.transactionsForAccount(transactions, null)).toBe(transactions);
  });

  test("handles missing market and negative gains", () => {
    const metrics = analytics.feeMetrics(
      { 2024: { manulife: 100, gst: 0, qst: 0, total: 100 } },
      { 2024: -200 },
      {},
    );
    expect(metrics[2024].annualRate).toBe(0);
    expect(metrics[2024].absorbed).toBe(0);
    expect(
      analytics.feeMetrics(
        { 2025: { manulife: 10, gst: 0, qst: 0, total: 10 } },
        {},
        { 2025: { average: 1000, months: 12 } },
      )[2025].gainAfterFees,
    ).toBe(0);
  });

  test("parses French dates", () => {
    expect(analytics.parseFrenchDate("19/09/2026").toISOString()).toBe("2026-09-19T00:00:00.000Z");
  });
});
