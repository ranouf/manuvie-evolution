(() => {
  "use strict";

  const columns = [
    "date",
    "institution",
    "compte",
    "type",
    "description",
    "montant",
    "devise",
    "titre",
    "quantite",
    "prix_unitaire",
    "frais",
    "reference",
  ];
  const cell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const serialize = (rows) =>
    `\uFEFF${[columns.join(","), ...rows.map((row) => columns.map((key) => cell(row[key])).join(","))].join("\r\n")}\r\n`;
  const filename = (company, date = new Date()) =>
    `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}_${company}_Transactions.csv`;
  const download = (filename, rows) => {
    const url = URL.createObjectURL(
      new Blob([serialize(rows)], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  globalThis.PortfolioCsv = { columns, serialize, filename, download };
})();
