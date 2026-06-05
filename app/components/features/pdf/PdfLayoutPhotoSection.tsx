import type { ReactNode } from "react";
import type { LayoutAnnotation, PhotoSlot, Project } from "../../planner/types";

type RenderAnnotatedImage = (props: {
  imageUrl: string;
  annotations: LayoutAnnotation[];
  alt: string;
}) => ReactNode;

type PdfLayoutPhotoPreviewProps = {
  selectedProject: Project;
  layoutPhotosFilled: PhotoSlot[];
  renderAnnotatedImage: RenderAnnotatedImage;
};

type PdfLayoutPhotoPrintPagesProps = {
  selectedProject: Project;
  layoutPhotoChunks: PhotoSlot[][];
  renderAnnotatedImage: RenderAnnotatedImage;
};

export function PdfLayoutPhotoPreview({
  selectedProject,
  layoutPhotosFilled,
  renderAnnotatedImage,
}: PdfLayoutPhotoPreviewProps) {
  return (
    <article className="preview-page">
      <h3>【工事車両、作業場所等の配置図】</h3>
      <div className="preview-layout-photo">
        {renderAnnotatedImage({
          imageUrl: selectedProject.layoutImageDataUrl,
          annotations: selectedProject.layoutAnnotations,
          alt: "配置図プレビュー",
        })}
      </div>
      <div className="preview-photo-grid">
        {layoutPhotosFilled.slice(0, 4).map((slot) => (
          <figure key={`preview_pdf7_photo_${slot.id}`} className="preview-photo-item">
            <div>
              {slot.dataUrl ? (
                renderAnnotatedImage({
                  imageUrl: slot.dataUrl,
                  annotations: slot.layoutAnnotations || [],
                  alt: slot.label,
                })
              ) : (
                <span>写真未設定</span>
              )}
            </div>
            <figcaption>{slot.label}</figcaption>
          </figure>
        ))}
        {!layoutPhotosFilled.length ? (
          <figure className="preview-photo-item">
            <div><span>写真が未設定です</span></div>
            <figcaption>写真を追加するとここに表示されます</figcaption>
          </figure>
        ) : null}
      </div>
    </article>
  );
}

export function PdfLayoutPhotoPrintPages({
  selectedProject,
  layoutPhotoChunks,
  renderAnnotatedImage,
}: PdfLayoutPhotoPrintPagesProps) {
  return (
    <>
      {(selectedProject.layoutImageDataUrl || layoutPhotoChunks.length > 0) && (
        <article className="print-page">
          <h2>【工事車両、作業場所等の配置図】</h2>
          {selectedProject.layoutImageDataUrl ? (
            <div className="layout-photo">
              {renderAnnotatedImage({
                imageUrl: selectedProject.layoutImageDataUrl,
                annotations: selectedProject.layoutAnnotations,
                alt: "配置図",
              })}
            </div>
          ) : null}
          {layoutPhotoChunks[0]?.length ? (
            <div className="detail-photo-grid">
              {layoutPhotoChunks[0].map((slot) => (
                <figure key={`layout_photo_first_${slot.id}`}>
                  <div>
                    {renderAnnotatedImage({
                      imageUrl: slot.dataUrl,
                      annotations: slot.layoutAnnotations || [],
                      alt: slot.label,
                    })}
                  </div>
                  <figcaption>{slot.label}</figcaption>
                </figure>
              ))}
            </div>
          ) : null}
        </article>
      )}
      {layoutPhotoChunks.slice(1).map((chunk, index) => (
        <article className="print-page" key={`layout_photo_page_${index}`}>
          <h2>【工事車両、作業場所等の配置図（写真）】</h2>
          <div className="detail-photo-grid">
            {chunk.map((slot) => (
              <figure key={`layout_photo_${slot.id}`}>
                <div>
                  {renderAnnotatedImage({
                    imageUrl: slot.dataUrl,
                    annotations: slot.layoutAnnotations || [],
                    alt: slot.label,
                  })}
                </div>
                <figcaption>{slot.label}</figcaption>
              </figure>
            ))}
          </div>
        </article>
      ))}
    </>
  );
}
