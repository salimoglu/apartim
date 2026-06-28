/* Apartım — gerçek .xlsx dosyası (SheetJS) */
(function () {
  "use strict";

  const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  window.APARTIM.XLSX_MIME = XLSX_MIME;

  window.APARTIM.xlsxBlob = function (aoa, sheetName, merges) {
    const XLSX = window.XLSX;
    if (!XLSX) throw new Error("Excel kütüphanesi yüklenemedi");
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    if (merges && merges.length) ws["!merges"] = merges;
    const wb = XLSX.utils.book_new();
    const ad = String(sheetName || "Sayfa1").slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, ad);
    const ab = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return new Blob([ab], { type: XLSX_MIME });
  };
})();
