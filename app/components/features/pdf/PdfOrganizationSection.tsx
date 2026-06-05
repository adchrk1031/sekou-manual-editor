import { PARTY_COMPANY_TEMPLATE_PRESETS } from "../../planner/constants";
import type {
  PartyCompanyTemplatePreset,
  PdfTemplatePreset,
  Project,
  RelatedParty,
  RelatedPartyKey,
  SimpleTemplate,
} from "../../planner/types";
import { CardPreview } from "../../planner/ui/CardPreview";
import { UiIcon } from "../../planner/ui/UiIcon";

type RelatedParties = Project["relatedParties"];
type RelatedPartyPatch = Partial<RelatedParty>;

type PdfOrganizationSectionProps = {
  className: string;
  activePdfTemplate: PdfTemplatePreset;
  selectedProject: Project;
  activeParties: RelatedParties;
  canEdit: boolean;
  partyTemplates: Array<SimpleTemplate<RelatedParties>>;
  selectedPartyTemplateId: string;
  selectedPartyTemplate?: SimpleTemplate<RelatedParties>;
  partyCompanyTemplates: Record<RelatedPartyKey, PartyCompanyTemplatePreset[]>;
  partyTemplateSelections: Record<RelatedPartyKey, string>;
  requiredMissingMap: Record<string, boolean>;
  partySlide: number;
  totalPartySlides: number;
  partySlideSize: number;
  partyEntries: RelatedPartyKey[];
  onSelectPartyTemplateId: (templateId: string) => void;
  onApplyPartyTemplate: () => void;
  onSavePartyTemplate: () => void;
  onDeletePartyTemplate: () => void;
  onPartySlideChange: (updater: (previous: number) => number) => void;
  onUpdateRelatedParty: (key: RelatedPartyKey, patch: RelatedPartyPatch) => void;
  onApplyRelatedPartyCompanyTemplate: (key: RelatedPartyKey, templateId: string) => void;
  onSaveRelatedPartyCompanyTemplate: (key: RelatedPartyKey) => void;
};

type PdfOrganizationPrintPagesProps = {
  activePdfTemplate: PdfTemplatePreset;
  activeParties: RelatedParties;
};

export function PdfOrganizationSection({
  className,
  activePdfTemplate,
  selectedProject,
  activeParties,
  canEdit,
  partyTemplates,
  selectedPartyTemplateId,
  selectedPartyTemplate,
  partyCompanyTemplates,
  partyTemplateSelections,
  requiredMissingMap,
  partySlide,
  totalPartySlides,
  partySlideSize,
  partyEntries,
  onSelectPartyTemplateId,
  onApplyPartyTemplate,
  onSavePartyTemplate,
  onDeletePartyTemplate,
  onPartySlideChange,
  onUpdateRelatedParty,
  onApplyRelatedPartyCompanyTemplate,
  onSaveRelatedPartyCompanyTemplate,
}: PdfOrganizationSectionProps) {
  return (
    <div className={className}>
      <section className="panel page-card" id="card-pdf6">
        <div className="page-card-head">
          <p className="page-card-index">PDF 6</p>
          <div>
            <h2>{activePdfTemplate.sectionOrganization}・{activePdfTemplate.sectionEmergency}</h2>
            <p className="mini">関係各社カードの「反映する」をONにしたものだけPDF6ページへ反映されます</p>
          </div>
        </div>
        <CardPreview title={`PDF6 ${activePdfTemplate.sectionOrganization}・${activePdfTemplate.sectionEmergency}`}>
          <article className="preview-page">
            <h3>4．{activePdfTemplate.sectionOrganization}</h3>
            <div className="preview-org-grid">
              {activeParties.owner.enabled ? (
                <div className="preview-org-box">
                  <p>{activeParties.owner.title}：{activeParties.owner.company || "-"}</p>
                  {activeParties.owner.person ? <p>担当者：{activeParties.owner.person}</p> : null}
                  {activeParties.owner.office ? <p>部署：{activeParties.owner.office}</p> : null}
                  <p>電話番号（TEL）：{activeParties.owner.tel || "-"}</p>
                </div>
              ) : null}
              {activeParties.utility.enabled ? (
                <div className="preview-org-box">
                  <p>{activeParties.utility.company || "-"}</p>
                  {activeParties.utility.office ? <p>事業所：{activeParties.utility.office}</p> : null}
                  <p>電話番号（TEL）：{activeParties.utility.tel || "-"}</p>
                </div>
              ) : null}
              {activeParties.contractor.enabled ? (
                <div className="preview-org-box preview-org-large">
                  <p>{activeParties.contractor.title}：{activeParties.contractor.company || "-"}</p>
                  {activeParties.contractor.office ? <p>{activeParties.contractor.office}</p> : null}
                  {activeParties.contractor.person ? <p>担当者：{activeParties.contractor.person}</p> : null}
                  <p>電話番号（TEL）：{activeParties.contractor.tel || "-"}</p>
                </div>
              ) : null}
            </div>
            <h3>5．{activePdfTemplate.sectionEmergency}</h3>
            <div className="preview-org-grid compact">
              {activeParties.management.enabled ? <div className="preview-org-box">{activeParties.management.company || "-"}</div> : null}
              {activeParties.owner.enabled ? <div className="preview-org-box">{activeParties.owner.company || "-"}<br />電話番号（TEL）：{activeParties.owner.tel || "-"}</div> : null}
              {activeParties.utility.enabled ? <div className="preview-org-box">{activeParties.utility.company || "-"}<br />電話番号（TEL）：{activeParties.utility.tel || "-"}</div> : null}
              {activeParties.contractor.enabled ? <div className="preview-org-box">{activeParties.contractor.company || "-"}<br />電話番号（TEL）：{activeParties.contractor.tel || "-"}</div> : null}
              {activeParties.residents.enabled ? <div className="preview-org-box">{activeParties.residents.company || "-"}</div> : null}
            </div>
          </article>
        </CardPreview>
        <div className="party-template-row">
          <label className="field party-template-field">
            <span>体制表テンプレート</span>
            <select
              className="control"
              value={selectedPartyTemplateId}
              onChange={(event) => onSelectPartyTemplateId(event.target.value)}
            >
              <option value="">テンプレートを選択</option>
              {partyTemplates.map((template) => (
                <option key={`party_template_local_${template.id}`} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <div className="inline-row wrap">
            <button
              type="button"
              className="btn btn-subtle"
              onClick={onApplyPartyTemplate}
              disabled={!selectedPartyTemplate}
            >
              <span className="btn-icon"><UiIcon name="apply" /></span>
              テンプレート適用
            </button>
            <button
              type="button"
              className="btn btn-subtle"
              onClick={onSavePartyTemplate}
              disabled={!canEdit}
            >
              <span className="btn-icon"><UiIcon name="save" /></span>
              現在内容をテンプレート登録
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={onDeletePartyTemplate}
              disabled={!canEdit || !selectedPartyTemplateId}
            >
              <span className="btn-icon"><UiIcon name="delete" /></span>
              テンプレート削除
            </button>
          </div>
        </div>
        <div className={`party-grid ${requiredMissingMap.relatedPartiesEnabled ? "required-missing-block" : ""}`} data-required-key="relatedPartiesEnabled">
          <div className="party-slider-nav">
            <button type="button" className="btn btn-subtle" onClick={() => onPartySlideChange((prev) => Math.max(0, prev - 1))} disabled={partySlide <= 0}>
              <span className="btn-icon"><UiIcon name="arrowLeft" /></span>
              前のスライド
            </button>
            <span className="mini">
              {partySlide + 1} / {totalPartySlides}
            </span>
            <button
              type="button"
              className="btn btn-subtle"
              onClick={() => onPartySlideChange((prev) => Math.min(totalPartySlides - 1, prev + 1))}
              disabled={partySlide >= totalPartySlides - 1}
            >
              <span className="btn-icon"><UiIcon name="arrowRight" /></span>
              次のスライド
            </button>
          </div>
          <div className="party-slider-window">
            <div className="party-slider-track" style={{ transform: `translateX(-${partySlide * 100}%)` }}>
              {Array.from({ length: totalPartySlides }, (_, slideIndex) => {
                const start = slideIndex * partySlideSize;
                const end = start + partySlideSize;
                const keys = partyEntries.slice(start, end);
                return (
                  <div key={`party_slide_${slideIndex}`} className="party-slide">
                    {keys.map((key) => {
                      const party = selectedProject.relatedParties[key];
                      const companyTemplateOptions = [
                        ...(partyCompanyTemplates[key] || []),
                        ...PARTY_COMPANY_TEMPLATE_PRESETS[key],
                      ];
                      return (
                        <article key={`party_${key}`} className="sub-panel party-card">
                          <div className="party-head">
                            <h3>{party.title}</h3>
                            <label className="party-check">
                              <input
                                type="checkbox"
                                checked={party.enabled}
                                onChange={(event) => onUpdateRelatedParty(key, { enabled: event.target.checked })}
                              />
                              計画書に反映する
                            </label>
                          </div>
                          <div className="field-grid">
                            <label className="field span-2">
                              <span>会社テンプレート（選択すると自動反映）</span>
                              <select
                                className="control"
                                value={partyTemplateSelections[key]}
                                onChange={(event) => onApplyRelatedPartyCompanyTemplate(key, event.target.value)}
                              >
                                <option value="">テンプレートを選択（任意）</option>
                                {companyTemplateOptions.map((template) => (
                                  <option key={`party_company_template_${key}_${template.id}`} value={template.id}>
                                    {template.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div className="inline-row wrap span-2 party-company-template-actions">
                              <button
                                type="button"
                                className="btn btn-subtle"
                                onClick={() => onSaveRelatedPartyCompanyTemplate(key)}
                                disabled={!canEdit}
                              >
                                <span className="btn-icon"><UiIcon name="save" /></span>
                                この内容をテンプレート登録
                              </button>
                            </div>
                            <label className="field"><span>見出し</span><input className="control" value={party.title} onChange={(event) => onUpdateRelatedParty(key, { title: event.target.value })} /></label>
                            <label className="field"><span>会社名 / 表示名</span><input data-required-key={`relatedPartyCompany:${key}`} className={`control ${party.enabled && !party.company.trim() ? "control-missing" : ""}`} value={party.company} onChange={(event) => onUpdateRelatedParty(key, { company: event.target.value })} /></label>
                            <label className="field"><span>担当者</span><input className="control" value={party.person} onChange={(event) => onUpdateRelatedParty(key, { person: event.target.value })} /></label>
                            <label className="field"><span>部署・事業所</span><input className="control" value={party.office} onChange={(event) => onUpdateRelatedParty(key, { office: event.target.value })} /></label>
                            <label className="field span-2"><span>電話番号（TEL）</span><input className="control" value={party.tel} onChange={(event) => onUpdateRelatedParty(key, { tel: event.target.value })} /></label>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function PdfOrganizationPrintPages({
  activePdfTemplate,
  activeParties,
}: PdfOrganizationPrintPagesProps) {
  return (
    <article className="print-page">
      <h2>4．{activePdfTemplate.sectionOrganization}</h2>
      <div className="organization-grid">
        {activeParties.owner.enabled ? (
          <div className="org-box">
            <p>{activeParties.owner.title}：{activeParties.owner.company || "-"}</p>
            {activeParties.owner.person ? <p>担当者：{activeParties.owner.person}</p> : null}
            {activeParties.owner.office ? <p>部署：{activeParties.owner.office}</p> : null}
            <p>電話番号（TEL）：{activeParties.owner.tel || "-"}</p>
          </div>
        ) : null}
        {activeParties.owner.enabled && activeParties.utility.enabled ? <div className="org-arrow horizontal">↔</div> : null}
        {activeParties.utility.enabled ? (
          <div className="org-box">
            <p>{activeParties.utility.company || "-"}</p>
            {activeParties.utility.office ? <p>事業所：{activeParties.utility.office}</p> : null}
            <p>電話番号（TEL）：{activeParties.utility.tel || "-"}</p>
          </div>
        ) : null}
        {(activeParties.owner.enabled || activeParties.utility.enabled) && activeParties.contractor.enabled ? <div className="org-arrow down">↓</div> : null}
        {activeParties.contractor.enabled ? (
          <div className="org-box large">
            <p>{activeParties.contractor.title}：{activeParties.contractor.company || "-"}</p>
            {activeParties.contractor.office ? <p>{activeParties.contractor.office}</p> : null}
            {activeParties.contractor.person ? <p>担当者：{activeParties.contractor.person}</p> : null}
            <p>電話番号（TEL）：{activeParties.contractor.tel || "-"}</p>
          </div>
        ) : null}
      </div>

      <h2>5．{activePdfTemplate.sectionEmergency}</h2>
      <div className="emergency-grid">
        {activeParties.management.enabled ? <div className="org-box emergency-a">{activeParties.management.company || "-"}</div> : null}
        {activeParties.management.enabled && activeParties.owner.enabled ? <div className="org-arrow horizontal emergency-ab">↔</div> : null}
        {activeParties.owner.enabled ? (
          <div className="org-box emergency-b">
            {activeParties.owner.company || "-"}
            <br />
            電話番号（TEL）：{activeParties.owner.tel || "-"}
          </div>
        ) : null}
        {activeParties.owner.enabled && activeParties.utility.enabled ? <div className="org-arrow down emergency-bc">↕</div> : null}
        {activeParties.utility.enabled ? (
          <div className="org-box emergency-c">
            {activeParties.utility.company || "-"}
            <br />
            電話番号（TEL）：{activeParties.utility.tel || "-"}
          </div>
        ) : null}
        {activeParties.owner.enabled && activeParties.contractor.enabled ? <div className="org-arrow horizontal emergency-bd">↔</div> : null}
        {activeParties.contractor.enabled ? (
          <div className="org-box emergency-d">
            {activeParties.contractor.company || "-"}
            {activeParties.contractor.person ? (
              <>
                <br />
                担当者：{activeParties.contractor.person}
              </>
            ) : null}
            <br />
            電話番号（TEL）：{activeParties.contractor.tel || "-"}
          </div>
        ) : null}
        {activeParties.residents.enabled ? <div className="org-box emergency-resident">{activeParties.residents.company || "-"}</div> : null}
      </div>
    </article>
  );
}
