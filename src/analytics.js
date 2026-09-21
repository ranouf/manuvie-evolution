(function exposeAnalytics(global) {
  "use strict";

  const valueOfPoint = (point) =>
    Array.isArray(point)
      ? [Number(point[0]), Number(point[1])]
      : [Number(point.x), Number(point.y)];

  const normalizeSeries = (series) => (Array.isArray(series) ? series.map(valueOfPoint) : []);

  const mergeSeries = (baseSeries, nextSeries) => {
    const points = new Map(normalizeSeries(baseSeries));
    for (const [timestamp, value] of normalizeSeries(nextSeries)) points.set(timestamp, value);
    return [...points.entries()].sort(([left], [right]) => left - right);
  };

  const mergeChartData = (baseData, nextData) => ({
    ...(baseData ?? {}),
    ...(nextData ?? {}),
    marketValue: mergeSeries(baseData?.marketValue, nextData?.marketValue),
    netInvestedCapital: mergeSeries(baseData?.netInvestedCapital, nextData?.netInvestedCapital),
  });

  const gainSeries = (marketValue, netInvestedCapital) => {
    const capital = new Map(
      normalizeSeries(netInvestedCapital).map(([date, value]) => [date, value]),
    );
    return normalizeSeries(marketValue)
      .filter(([date]) => capital.has(date))
      .map(([date, value]) => [date, value - capital.get(date)]);
  };

  const yearOf = (timestamp) => new Date(timestamp).getUTCFullYear();

  const yearlyGains = (series) => {
    const result = {};
    let previous = 0;
    for (const [timestamp, value] of normalizeSeries(series)) {
      const year = yearOf(timestamp);
      if (!result[year]) result[year] = { start: previous, end: value };
      result[year].end = value;
      previous = value;
    }
    return Object.fromEntries(
      Object.entries(result).map(([year, values]) => [year, values.end - values.start]),
    );
  };

  const averageMarketValueByYear = (series) => {
    const grouped = {};
    for (const [timestamp, value] of normalizeSeries(series)) {
      const year = yearOf(timestamp);
      grouped[year] ??= [];
      grouped[year].push(value);
    }
    return Object.fromEntries(
      Object.entries(grouped).map(([year, values]) => [
        year,
        {
          average: values.reduce((sum, value) => sum + value, 0) / values.length,
          months: values.length,
        },
      ]),
    );
  };

  const yearlyReturnRates = (gainsByYear, marketValuesByYear) =>
    Object.fromEntries(
      Object.entries(gainsByYear).map(([year, gain]) => {
        const market = marketValuesByYear[year] ?? { average: 0, months: 0 };
        return [year, market.average ? (gain / market.average) * (12 / market.months) * 100 : 0];
      }),
    );

  const parseFrenchDate = (value) => {
    const [day, month, year] = String(value).split("/").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  };

  const feeCategory = (transaction) => {
    const value = `${transaction.transactionType ?? ""} ${transaction.securityDescription ?? ""}`;
    if (/\b(TPS|GST)\b/i.test(value)) return "gst";
    if (/\b(TVQ|QST)\b|taxe de vente du qu[ée]bec/i.test(value)) return "qst";
    if (/frais|fee/i.test(value)) return "manulife";
    return null;
  };

  const aggregateFees = (transactions) => {
    const result = {};
    for (const transaction of transactions) {
      const category = feeCategory(transaction);
      if (!category) continue;
      const year = parseFrenchDate(transaction.tradeDate).getUTCFullYear();
      result[year] ??= { manulife: 0, gst: 0, qst: 0, total: 0 };
      const amount = Math.abs(Number(transaction.totalValue));
      result[year][category] += amount;
      result[year].total += amount;
    }
    return result;
  };

  const contributionCategory = (transaction) => {
    const value = `${transaction.transactionType ?? ""} ${transaction.securityDescription ?? ""}`;
    if (
      /cotisation|contribution|d[ée]p[oô]t|deposit|versement|transfert entrant|transfer in/i.test(
        value,
      )
    )
      return "contribution";
    return null;
  };

  const aggregateContributions = (transactions) => {
    const result = {};
    for (const transaction of transactions) {
      if (!contributionCategory(transaction)) continue;
      const amount = Number(transaction.totalValue);
      if (amount <= 0) continue;
      const year = parseFrenchDate(transaction.tradeDate).getUTCFullYear();
      result[year] ??= { total: 0 };
      result[year].total += amount;
    }
    return result;
  };

  const listContributions = (transactions) =>
    transactions
      .filter(
        (transaction) => contributionCategory(transaction) && Number(transaction.totalValue) > 0,
      )
      .map((transaction) => ({
        accountNumber: transaction.accountNumber,
        amount: Number(transaction.totalValue),
        securityDescription: transaction.securityDescription,
        timestamp: parseFrenchDate(transaction.tradeDate).getTime(),
        transactionType: transaction.transactionType,
      }))
      .sort((left, right) => left.timestamp - right.timestamp);

  const transactionsForAccount = (transactions, accountNumber) =>
    accountNumber == null
      ? transactions
      : transactions.filter(
          (transaction) => String(transaction.accountNumber) === String(accountNumber),
        );

  const feeMetrics = (feesByYear, gainsByYear, marketValuesByYear) =>
    Object.fromEntries(
      Object.entries(feesByYear).map(([year, fees]) => {
        const gainAfterFees = gainsByYear[year] ?? 0;
        const gainBeforeFees = gainAfterFees + fees.total;
        const market = marketValuesByYear[year] ?? { average: 0, months: 0 };
        return [
          year,
          {
            ...fees,
            gainAfterFees,
            gainBeforeFees,
            annualRate: market.average
              ? (fees.total / market.average) * (12 / market.months) * 100
              : 0,
            absorbed: gainBeforeFees > 0 ? (fees.total / gainBeforeFees) * 100 : 0,
            months: market.months,
          },
        ];
      }),
    );

  const api = {
    aggregateContributions,
    aggregateFees,
    averageMarketValueByYear,
    contributionCategory,
    feeCategory,
    feeMetrics,
    gainSeries,
    listContributions,
    mergeChartData,
    mergeSeries,
    normalizeSeries,
    parseFrenchDate,
    transactionsForAccount,
    yearlyGains,
    yearlyReturnRates,
  };

  global.ManuvieAnalytics = api;
  /* istanbul ignore else -- module existe uniquement pendant les tests Node. */
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
