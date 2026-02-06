import React, { useEffect, useMemo, useState } from "react";
import { PDFDocument } from "pdf-lib";

const formatBytes = (bytes: number) => {
  if (!bytes && bytes !== 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
};

const readArrayBuffer = (file: File): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });

type PdfInfo = {
  name: string;
  pages: number;
  size: number;
};

export default function App() {
  const [oddFile, setOddFile] = useState<File | null>(null);
  const [evenFile, setEvenFile] = useState<File | null>(null);
  const [oddInfo, setOddInfo] = useState<PdfInfo>({
    name: "-",
    pages: 0,
    size: 0,
  });
  const [evenInfo, setEvenInfo] = useState<PdfInfo>({
    name: "-",
    pages: 0,
    size: 0,
  });
  const [status, setStatus] = useState("PDFを2つ選択してください。");
  const [busy, setBusy] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [resultInfo, setResultInfo] = useState<PdfInfo>({
    pages: 0,
    size: 0,
    name: "-",
  });
  useEffect(() => {
    return () => {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  const canMerge = useMemo(
    () => oddFile && evenFile && !busy,
    [oddFile, evenFile, busy],
  );

  const inspectPdf = async (
    file: File,
    setInfo: React.Dispatch<React.SetStateAction<PdfInfo>>,
  ) => {
    if (!file) return;
    const bytes = await readArrayBuffer(file);
    const pdf = await PDFDocument.load(bytes);
    setInfo({
      name: file.name,
      pages: pdf.getPageCount(),
      size: file.size,
    });
  };

  const handleOddChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] ?? null;
    setOddFile(file);
    setDownloadUrl("");
    setResultInfo({ pages: 0, size: 0, name: "-" });
    if (!file) {
      setOddInfo({ name: "-", pages: 0, size: 0 });
      setStatus("PDFを2つ選択してください。");
      return;
    }
    try {
      await inspectPdf(file, setOddInfo);
      setStatus("PDFを2つ選択してください。");
    } catch {
      setStatus("PDF Aの読み込みに失敗しました。");
      setOddInfo({ name: "-", pages: 0, size: 0 });
    }
  };

  const handleEvenChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] ?? null;
    setEvenFile(file);
    setDownloadUrl("");
    setResultInfo({ pages: 0, size: 0, name: "-" });
    if (!file) {
      setEvenInfo({ name: "-", pages: 0, size: 0 });
      setStatus("PDFを2つ選択してください。");
      return;
    }
    try {
      await inspectPdf(file, setEvenInfo);
      setStatus("PDFを2つ選択してください。");
    } catch {
      setStatus("PDF Bの読み込みに失敗しました。");
      setEvenInfo({ name: "-", pages: 0, size: 0 });
    }
  };

  const mergePdfs = async () => {
    if (!oddFile || !evenFile) return;
    setBusy(true);
    setStatus("結合中...");
    setDownloadUrl("");
    try {
      const [oddBytes, evenBytes] = await Promise.all([
        readArrayBuffer(oddFile),
        readArrayBuffer(evenFile),
      ]);
      const [oddPdf, evenPdf] = await Promise.all([
        PDFDocument.load(oddBytes),
        PDFDocument.load(evenBytes),
      ]);

      const output = await PDFDocument.create();
      const oddPages = oddPdf.getPages();
      const evenPages = evenPdf.getPages();
      const maxPages = Math.max(oddPages.length, evenPages.length);

      for (let i = 0; i < maxPages; i += 1) {
        if (i < oddPages.length) {
          const [page] = await output.copyPages(oddPdf, [i]);
          output.addPage(page);
        }
        if (i < evenPages.length) {
          const [page] = await output.copyPages(evenPdf, [i]);
          output.addPage(page);
        }
      }

      const mergedBytes = await output.save();
      const buffer = mergedBytes.buffer.slice(
        mergedBytes.byteOffset,
        mergedBytes.byteOffset + mergedBytes.byteLength
      ) as ArrayBuffer;
      const blob = new Blob([buffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const baseName = oddFile.name || "interleaved.pdf";
      const mergedName = `al-${baseName}`;
      setDownloadUrl(url);
      setResultInfo({
        pages: output.getPageCount(),
        size: blob.size,
        name: mergedName,
      });
      setStatus("完了しました。");
    } catch {
      setStatus("結合に失敗しました。PDFを確認してください。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="app">
      <header className="hero">
        <p className="kicker">Client-only PDF tool</p>
        <h1>PDF Interleave</h1>
        <p className="sub">
          2つのPDFを読み込んで、奇数ページ/偶数ページとして交互に結合します。
        </p>
      </header>

      <section className="panel">
        <div className="field">
          <label htmlFor="oddPdf">PDF A（奇数ページ）</label>
          <input
            id="oddPdf"
            type="file"
            accept="application/pdf"
            onChange={handleOddChange}
          />
          <div className="meta">
            {oddInfo.name} ・ {oddInfo.pages}ページ ・{" "}
            {formatBytes(oddInfo.size)}
          </div>
        </div>
        <div className="field">
          <label htmlFor="evenPdf">PDF B（偶数ページ）</label>
          <input
            id="evenPdf"
            type="file"
            accept="application/pdf"
            onChange={handleEvenChange}
          />
          <div className="meta">
            {evenInfo.name} ・ {evenInfo.pages}ページ ・{" "}
            {formatBytes(evenInfo.size)}
          </div>
        </div>

        <div className="actions">
          <button type="button" onClick={mergePdfs} disabled={!canMerge}>
            {busy ? "結合中..." : "結合する"}
          </button>
          <span className="status">{status}</span>
        </div>
      </section>

      <section className="result panel">
        <div className="result-row">
          <span>出力</span>
          <a
            className={`download ${downloadUrl ? "" : "disabled"}`}
            href={downloadUrl || "#"}
            download={resultInfo.name}
            onClick={(event) => {
              if (!downloadUrl) event.preventDefault();
            }}
          >
            生成したPDFをダウンロード
          </a>
        </div>
        <div className="meta">
          {resultInfo.pages
            ? `${resultInfo.name} ・ ${resultInfo.pages}ページ ・ ${formatBytes(resultInfo.size)}`
            : "まだ生成されていません。"}
        </div>
      </section>
    </main>
  );
}
