import type { ChangeEvent } from "react";
import { PDF_LOGO_FALLBACK_SRC } from "../constants";
import type { PdfTemplatePreset, Project, RelatedParty } from "../types";
import { CardPreview } from "./CardPreview";
import { UiIcon } from "./UiIcon";

type PdfCoverAndTocSectionProps = {
  canExportPdf: boolean;
  totalMissingRequiredCount: number;
  scrollToMissingField: () => void;
  requiredHint: string;
  selectedProject: Project;
  activePdfTemplate: PdfTemplatePreset;
  activeLogoSrc: string;
  ownerParty: RelatedParty;
  requiredMissingMap: Record<string, boolean>;
  formatDateWithWeekday: (date: string) => string;
  pdfTemplatePresets: readonly PdfTemplatePreset[];
  handlePdfTemplateChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onPropertyNameChange: (value: string) => void;
  onCoverRecipientSuffixChange: (value: string) => void;
  onTitleSubjectChange: (value: string) => void;
};

export function PdfCoverAndTocSection({
  canExportPdf,
  totalMissingRequiredCount,
  scrollToMissingField,
  requiredHint,
  selectedProject,
  activePdfTemplate,
  activeLogoSrc,
  ownerParty,
  requiredMissingMap,
  formatDateWithWeekday,
  pdfTemplatePresets,
  handlePdfTemplateChange,
  onPropertyNameChange,
  onCoverRecipientSuffixChange,
  onTitleSubjectChange,
}: PdfCoverAndTocSectionProps) {
  return (
    <>
      <section className="panel required-summary-panel">
        <div className="panel-head">
          <h3>必須入力チェック</h3>
          <p className={`status-chip ${canExportPdf ? "ok" : "warn"}`}>
            {canExportPdf ? "入力完了" : `未入力 ${totalMissingRequiredCount}件`}
          </p>
        </div>
        {!canExportPdf ? (
          <>
            <p className="mini">未入力項目があるため、PDF出力は無効です。最初の未入力へ移動して入力してください。</p>
            <div className="inline-row wrap">
              <button type="button" className="btn btn-subtle" onClick={scrollToMissingField}>
                <span className="btn-icon"><UiIcon name="down" /></span>最初の未入力へ移動
              </button>
            </div>
          </>
        ) : (
          <p className="mini">必須項目はすべて入力済みです。PDF出力できます。</p>
        )}
        {requiredHint ? <p className="error-text">{requiredHint}</p> : null}
      </section>

      <section className="panel page-card" id="card-pdf1">
        <div className="page-card-head">
          <p className="page-card-index">PDF 1</p>
          <div>
            <h2>表紙</h2>
            <p className="mini">このカードの入力がPDF1ページ目に反映されます</p>
          </div>
        </div>
        <CardPreview title="PDF1 表紙">
          <article className="preview-page">
            <div className="preview-cover-top">
              <p>{formatDateWithWeekday(selectedProject.workDateStart)}</p>
              <p>{activePdfTemplate.coverKicker}</p>
            </div>
            <h3 className="preview-cover-building">{selectedProject.propertyName}　{selectedProject.coverRecipientSuffix || "管理組合御中"}</h3>
            <p className="preview-cover-subject">{selectedProject.titleSubject}</p>
            <p className="preview-cover-subject">施工計画書</p>
            <div className="preview-logo-wrap">
              <img
                className="preview-logo"
                src={activeLogoSrc}
                alt="Rezil ロゴ"
                onError={(event) => {
                  event.currentTarget.src = PDF_LOGO_FALLBACK_SRC;
                }}
              />
            </div>
            <section className="preview-company">
              <h4>{ownerParty.company || selectedProject.pdfCompanyName || "-"}</h4>
              <dl>
                <dt>{activePdfTemplate.coverTeamLabel}</dt>
                <dd>{ownerParty.office || selectedProject.pdfTeam || "-"}</dd>
                <dt>担当者</dt>
                <dd>{ownerParty.person || selectedProject.pdfContactPerson || "-"}</dd>
                <dt>住所</dt>
                <dd>{selectedProject.pdfAddress || "-"}</dd>
                <dt>E-mail</dt>
                <dd>{selectedProject.pdfEmail || "-"}</dd>
                <dt>電話番号（TEL）</dt>
                <dd>{ownerParty.tel || selectedProject.pdfTel || "-"}</dd>
                <dt>FAX</dt>
                <dd>{selectedProject.pdfFax || "-"}</dd>
              </dl>
            </section>
          </article>
        </CardPreview>
        <article className="sub-panel">
          <h3>表紙テキスト</h3>
          <p className="field-help">上から順に入力すると迷いません。物件名 → 宛名 → 件名 の順で入力してください。</p>
          <div className="field-grid">
            <label className="field span-2">
              <span>PDFフォーマット</span>
              <select
                className="control"
                value={selectedProject.pdfTemplateId}
                onChange={handlePdfTemplateChange}
              >
                {pdfTemplatePresets.map((template) => (
                  <option key={`pdf_template_${template.id}`} value={template.id}>
                    {template.label}
                  </option>
                ))}
              </select>
              <p className="mini">{activePdfTemplate.description}</p>
            </label>
            <label className="field"><span>物件名</span><input data-required-key="propertyName" className={`control ${requiredMissingMap.propertyName ? "control-missing" : ""}`} value={selectedProject.propertyName} onChange={(event) => onPropertyNameChange(event.target.value)} /></label>
            <label className="field"><span>表紙宛名（末尾）</span><input data-required-key="coverRecipientSuffix" className={`control ${requiredMissingMap.coverRecipientSuffix ? "control-missing" : ""}`} value={selectedProject.coverRecipientSuffix} onChange={(event) => onCoverRecipientSuffixChange(event.target.value)} /></label>
            <label className="field span-2"><span>件名</span><input data-required-key="titleSubject" className={`control ${requiredMissingMap.titleSubject ? "control-missing" : ""}`} value={selectedProject.titleSubject} onChange={(event) => onTitleSubjectChange(event.target.value)} /></label>
          </div>
        </article>
      </section>

      <section className="panel page-card" id="card-pdf2">
        <div className="page-card-head">
          <p className="page-card-index">PDF 2</p>
          <div>
            <h2>目次</h2>
            <p className="mini">
              目次は選択したPDFフォーマットに連動します
              （1:{activePdfTemplate.tocItems[0]} / 2:{activePdfTemplate.tocItems[1]} / 3:{activePdfTemplate.tocItems[2]} / 4:{activePdfTemplate.tocItems[3]} / 5:{activePdfTemplate.tocItems[4]}）
            </p>
          </div>
        </div>
        <CardPreview title="PDF2 目次">
          <article className="preview-page">
            <h3>目次</h3>
            <ol className="preview-toc-list">
              {activePdfTemplate.tocItems.map((item) => (
                <li key={`preview_toc_${item}`}>{item}</li>
              ))}
            </ol>
          </article>
        </CardPreview>
      </section>
    </>
  );
}
