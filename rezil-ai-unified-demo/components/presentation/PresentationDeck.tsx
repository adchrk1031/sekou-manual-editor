"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { currentIssues, projects, tools } from "@/data/demoData";

type Slide = {
  id: string;
  isCover?: boolean;
  title: string;
  message: string;
  content: ReactNode;
};

const aiRoles = ["文章作成", "資料検索", "次タスク提示", "進捗整理"];
const humanRoles = ["判断", "管理", "対人対応"];
const crossToolFlow = ["Salesforce", "freee", "Kickflow", "Slack"];
const projectFlowStatus: Record<
  string,
  {
    currentTool: string;
    currentAction: string;
    nextTool: string;
    nextAction: string;
  }
> = {
  "project-a": {
    currentTool: "Kickflow",
    currentAction: "停電申請",
    nextTool: "Slack",
    nextAction: "施工依頼共有"
  },
  "project-b": {
    currentTool: "Salesforce",
    currentAction: "案件起票",
    nextTool: "freee",
    nextAction: "予算確認"
  },
  "project-c": {
    currentTool: "Kickflow",
    currentAction: "完了承認",
    nextTool: "Slack",
    nextAction: "完了共有"
  }
};

export function PresentationDeck() {
  const slides = useMemo<Slide[]>(
    () => [
      {
        id: "slide-cover",
        isCover: true,
        title: "AIについて",
        message: "レジル業務を前進させる、AI活用と自社開発の全体像",
        content: (
          <div className="relative flex h-full flex-col justify-between p-6 text-white md:p-10">
            <div className="flex items-center justify-between">
              <span className="heading-en rounded-full border border-white/35 bg-white/12 px-4 py-1.5 text-xs font-semibold tracking-[0.16em] text-[#EAF9FC]">
                COVER
              </span>
              <span className="rounded-full border border-white/35 bg-white/12 px-4 py-1.5 text-xs font-semibold text-[#EAF9FC]">
                非公開打ち合わせ
              </span>
            </div>
            <div className="max-w-4xl">
              <p className="heading-en text-sm font-semibold uppercase tracking-[0.2em] text-[#DDFBFF]">
                AI Strategy Presentation
              </p>
              <h2 className="mt-4 text-5xl font-bold leading-[1.08] md:text-7xl">
                AIについて
              </h2>
              <p className="mt-6 max-w-3xl rounded-xl border border-white/40 bg-white/12 px-5 py-4 text-base leading-7 text-[#F4FEFF] md:text-lg">
                ツール乱立による業務分断を、AI活用と自社開発基盤で再設計し、
                進捗可視化・工数削減・品質向上を実現するための提案資料。
              </p>
            </div>
            <div className="text-sm font-semibold text-[#EAF9FC]">
              Decarbonization x Digital x Design
            </div>
          </div>
        )
      },
      {
        id: "slide-1",
        title: "レジル業務構造の課題",
        message: "ツールが多すぎて、業務が分断されている",
        content: (
          <div className="grid h-full items-stretch gap-4 md:grid-cols-[1.22fr_0.78fr]">
            <div className="flex h-full flex-col rounded-2xl border border-[#D9E1EB] bg-white p-5">
              <p className="heading-en text-xs font-semibold uppercase tracking-[0.12em] text-[#1FADC3]">
                Current Tool Stack
              </p>
              <div className="mt-4 grid flex-1 gap-4 lg:grid-cols-[0.92fr_1.08fr]">
                <div className="flex h-full flex-col rounded-xl border border-[#D9E1EB] bg-[#F5F7FA] p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-md border border-[#1FADC3] bg-white text-[#1FADC3]">
                      <svg
                        viewBox="0 0 24 24"
                        width="24"
                        height="24"
                        fill="none"
                        aria-hidden="true"
                        className="stroke-current"
                      >
                        <rect x="5" y="7" width="14" height="11" rx="2" strokeWidth="1.6" />
                        <path d="M12 3v3M9 12h0.01M15 12h0.01M9 15h6" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div>
                      <p className="heading-en text-xs font-semibold uppercase tracking-[0.12em] text-[#1FADC3]">
                        AI Coordination
                      </p>
                      <p className="text-lg font-semibold leading-tight text-[#333333]">
                        業務ハブ（統合の中心）
                      </p>
                    </div>
                  </div>
                  <ul className="mt-4 space-y-2.5 text-[15px] text-[#556070]">
                    <li className="rounded-md border border-[#D9E1EB] bg-white px-3.5 py-2.5">
                      入力先の統一
                    </li>
                    <li className="rounded-md border border-[#D9E1EB] bg-white px-3.5 py-2.5">
                      進捗の横断可視化
                    </li>
                    <li className="rounded-md border border-[#D9E1EB] bg-white px-3.5 py-2.5">
                      次アクションの自動提案
                    </li>
                  </ul>
                </div>
                <div className="flex h-full flex-col rounded-xl border border-[#D9E1EB] bg-white p-4">
                  <p className="heading-en text-xs font-semibold uppercase tracking-[0.12em] text-[#1FADC3]">
                    Connected Tools
                  </p>
                  <div className="mt-3 grid flex-1 content-start gap-2 sm:grid-cols-2">
                    {tools.map((tool) => (
                      <div
                        key={tool.id}
                        className="rounded-md border border-[#D9E1EB] bg-[#F8FAFC] px-3.5 py-3 text-center"
                      >
                        <p className="text-[1.08rem] font-semibold leading-tight text-[#333333]">
                          {tool.name}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex h-full flex-col rounded-2xl border border-[#D9E1EB] bg-[#1FADC3] p-5 text-white">
              <p className="heading-en text-xs font-semibold uppercase tracking-[0.12em]">
                Observation
              </p>
              <p className="mt-3 text-3xl font-bold">{tools.length} Tools</p>
              <p className="mt-2 text-[15px] leading-6 text-[#EAF9FC]">
                情報の所在が分散し、同じ案件でも確認先が毎回変わる状態。
              </p>
              <div className="mt-4 grid gap-2 text-sm text-[#EAF9FC]">
                <div className="rounded-lg border border-white/25 bg-white/10 px-3 py-2">
                  案件確認先: 毎回変わる
                </div>
                <div className="rounded-lg border border-white/25 bg-white/10 px-3 py-2">
                  引き継ぎ時: 文脈が途切れやすい
                </div>
                <div className="rounded-lg border border-white/25 bg-white/10 px-3 py-2">
                  進捗確認: 横断確認に時間がかかる
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-white/10 px-3 py-2.5 text-sm">
                「多い」だけでなく、流れが切れることが課題
              </div>
              <div className="mt-auto pt-4 text-sm font-semibold text-white/90">
                だからこそ、統合された業務ハブが必要
              </div>
            </div>
          </div>
        )
      },
      {
        id: "slide-2",
        title: "現場で起きていること",
        message: "個人の問題ではなく、仕組みの問題",
        content: (
          <div className="grid h-full auto-rows-fr gap-4 md:grid-cols-2">
            {currentIssues.map((issue) => (
              <article
                key={issue.id}
                className="h-full rounded-xl border border-[#E3E8F0] bg-white p-6"
              >
                <p className="heading-en text-xs font-semibold uppercase tracking-[0.1em] text-[#1FADC3]">
                  Issue
                </p>
                <h3 className="mt-2 text-xl font-bold text-[#333333]">{issue.title}</h3>
                <p className="mt-3 leading-7 text-[#556070]">{issue.description}</p>
              </article>
            ))}
          </div>
        )
      },
      {
        id: "slide-3",
        title: "なぜ進捗が見えなくなるのか",
        message:
          "複数ツールをまたぐと、全体状況が一目で把握できない",
        content: (
          <div className="grid h-full gap-6 md:grid-cols-[1.12fr_0.88fr]">
            <div className="h-full rounded-2xl border border-[#D9E1EB] bg-white p-5">
              <p className="heading-en text-xs font-semibold uppercase tracking-[0.12em] text-[#1FADC3]">
                Tool Flow By Project
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {crossToolFlow.map((tool, index) => (
                  <div key={tool} className="flex items-center gap-1.5">
                    <span className="rounded-md border border-[#BFD6EA] bg-[#F8FBFF] px-2 py-1 text-[11px] font-semibold text-[#1FADC3]">
                      {tool}
                    </span>
                    {index < crossToolFlow.length - 1 ? (
                      <span className="text-xs text-[#8AA0B8]">→</span>
                    ) : null}
                  </div>
                ))}
              </div>
              <ul className="mt-3 space-y-2">
                {projects.map((project) => {
                  const rate = Math.round(
                    (project.progressCurrent / project.progressTotal) * 100
                  );
                  const status = projectFlowStatus[project.id];
                  return (
                    <li key={project.id} className="rounded-xl border border-[#D9E1EB] bg-[#F8FAFC] p-2.5">
                      <div className="grid gap-2 md:grid-cols-[88px_1fr_140px_140px] md:items-center">
                        <p className="text-sm font-semibold text-[#333333]">{project.projectName}</p>
                        <div>
                          <div className="flex items-center justify-between text-[11px] font-medium text-[#556070]">
                            <span>進捗</span>
                            <span>
                              {project.progressCurrent}/{project.progressTotal}
                            </span>
                          </div>
                          <div className="mt-1.5 h-2 w-full rounded-full bg-[#E4EAF2]">
                            <div
                              className="h-2 rounded-full bg-[#1FADC3]"
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                        </div>
                        <div className="rounded-md border border-[#D9E1EB] bg-white px-2.5 py-2">
                          <p className="text-[10px] text-[#7A8698]">現在</p>
                          <p className="text-xs font-semibold text-[#1FADC3]">{status?.currentTool}</p>
                          <p className="text-[10px] leading-4 text-[#556070]">{status?.currentAction}</p>
                        </div>
                        <div className="rounded-md border border-[#D9E1EB] bg-white px-2.5 py-2">
                          <p className="text-[10px] text-[#7A8698]">次</p>
                          <p className="text-xs font-semibold text-[#1FADC3]">{status?.nextTool}</p>
                          <p className="text-[10px] leading-4 text-[#556070]">{status?.nextAction}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="h-full rounded-2xl border border-dashed border-[#B6C4D5] bg-[#F5F7FA] p-5">
              <p className="heading-en text-xs font-semibold uppercase tracking-[0.12em] text-[#1FADC3]">
                Why Visibility Is Lost
              </p>
              <div className="mt-4 space-y-2.5 text-sm leading-6 text-[#556070]">
                {[
                  "案件ごとに進行先ツールが異なり、確認順が固定されない",
                  "承認・依頼・記録が別ツールに分かれ、完了判定が揃わない",
                  "管理者は都度ヒアリングしないと現在地を把握しづらい"
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-lg border border-[#D9E1EB] bg-white px-4 py-2.5"
                  >
                    {item}
                  </div>
                ))}
              </div>
              <p className="mt-4 rounded-lg border border-[#1FADC3] bg-[#1FADC3] px-4 py-3 text-sm font-semibold leading-6 text-white">
                「どこまで終わったか」を1画面で見えないことが、遅延と出戻りの原因
              </p>
              <div className="mt-4 rounded-lg border border-[#D9E1EB] bg-white px-4 py-3 text-sm leading-6 text-[#556070]">
                例: Salesforce更新 → freee確認 → Kickflow承認 → Slack依頼を追って、ようやく全体が分かる。
              </div>
            </div>
          </div>
        )
      },
      {
        id: "slide-4",
        title: "解決策は、一元管理された自社基盤（自社開発）",
        message: "SaaS契約費と運用工数を圧縮しつつ、自社ルールに合わせた柔軟制御を実現する",
        content: (
          <div className="grid h-full gap-5 md:grid-cols-[0.95fr_1.05fr]">
            <article className="flex h-full flex-col rounded-2xl border border-[#D9E1EB] bg-white p-5">
              {[
                { title: "社員", subtitle: "入力・確認・判断" },
                { title: "社内AI", subtitle: "検索・整理・提案" },
                { title: "自社業務システム（自社開発）", subtitle: "案件情報・進捗・履歴を統合" }
              ].map((item, index) => (
                <div key={item.title}>
                  <div className="rounded-xl border border-[#D9E1EB] bg-[#F8FAFC] px-5 py-4 text-center">
                    <p className="text-xl font-bold text-[#1FADC3]">{item.title}</p>
                    <p className="mt-1 text-sm text-[#556070]">{item.subtitle}</p>
                  </div>
                  {index < 2 ? (
                    <div className="py-1.5 text-center text-2xl font-light text-[#1FADC3]">↓</div>
                  ) : null}
                </div>
              ))}
            </article>

            <article className="flex h-full flex-col gap-3 rounded-2xl border border-[#D9E1EB] bg-white p-5">
              <section className="rounded-xl border border-[#D9E1EB] bg-[#F5F7FA] p-4">
                <p className="heading-en text-xs font-semibold uppercase tracking-[0.12em] text-[#1FADC3]">
                  Benefits Of In-House Development
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-[#556070]">
                  <li>・契約中SaaSの重複機能を整理し、契約費を圧縮しやすくなる</li>
                  <li>・工程の出戻り・抜け漏れを減らし、再作業工数を削減できる</li>
                  <li>・自動化により定型業務を短縮し、人員は判断業務へ集中できる</li>
                  <li>・自社ルールに合わせて、通知条件や承認フローを柔軟に設定できる</li>
                </ul>
              </section>

              <section className="rounded-xl border border-[#1FADC3] bg-[#1FADC3] px-4 py-3 text-white">
                <p className="text-sm font-semibold leading-6">
                  例: 10工程フローのうち、7工程目で未完了なら自動アラートを送信。
                </p>
                <p className="mt-1 text-xs leading-5 text-[#EAF9FC]">
                  遅延の早期検知と、出戻り前の先回り対応が可能。
                </p>
              </section>

              <section className="rounded-xl border border-[#F0C8C8] bg-[#FFF5F5] p-4">
                <p className="heading-en text-xs font-semibold uppercase tracking-[0.12em] text-[#C44949]">
                  Caution
                </p>
                <ul className="mt-2 space-y-1.5 text-sm leading-6 text-[#7A4B4B]">
                  <li>・更新・改善できる人員がいないと、改修が滞り運用改善スピードが落ちる</li>
                  <li>・AI利用時は、ライセンス人数に応じてAI契約費が発生する</li>
                </ul>
              </section>
            </article>
          </div>
        )
      },
      {
        id: "slide-5",
        title: "AIエージェントで変わる仕事の進め方",
        message:
          "人を減らすのではなく、人にしかできない仕事へ集中する",
        content: (
          <div className="grid h-full gap-5 md:grid-cols-2">
            <article className="h-full rounded-2xl border border-[#C8D8EE] bg-white p-6">
              <p className="heading-en text-xs font-semibold uppercase tracking-[0.12em] text-[#1FADC3]">
                AIが担うこと
              </p>
              <ul className="mt-4 space-y-3">
                {aiRoles.map((role) => (
                  <li
                    key={role}
                    className="rounded-lg border border-[#D9E1EB] bg-[#F5F7FA] px-4 py-3 font-medium"
                  >
                    {role}
                  </li>
                ))}
              </ul>
            </article>
            <article className="h-full rounded-2xl border border-[#D9E1EB] bg-white p-6">
              <p className="heading-en text-xs font-semibold uppercase tracking-[0.12em] text-[#1FADC3]">
                人が担うこと
              </p>
              <ul className="mt-4 space-y-3">
                {humanRoles.map((role) => (
                  <li
                    key={role}
                    className="rounded-lg border border-[#D9E1EB] bg-[#F5F7FA] px-4 py-3 font-medium"
                  >
                    {role}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        )
      },
      {
        id: "slide-6",
        title: "今後の構想",
        message:
          "自社に最適化された仕組みを作る会社へ",
        content: (
          <div className="grid h-full gap-6 md:grid-cols-[1.1fr_0.9fr]">
            <div className="h-full rounded-2xl border border-[#D9E1EB] bg-white p-6">
              <p className="heading-en text-xs font-semibold uppercase tracking-[0.12em] text-[#1FADC3]">
                Future Focus
              </p>
              <ul className="mt-4 space-y-3">
                {[
                  "AIを活用した自社ツール開発",
                  "業務統合",
                  "自動化",
                  "将来的なAI事業部構想"
                ].map((item) => (
                  <li
                    key={item}
                    className="rounded-lg border border-[#D9E1EB] px-4 py-3"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex h-full flex-col rounded-2xl border border-[#1FADC3] bg-[#1FADC3] p-6 text-white">
              <p className="heading-en text-xs font-semibold uppercase tracking-[0.12em] text-[#E6FF00]">
                Closing Message
              </p>
              <p className="mt-6 text-2xl font-bold leading-tight">
                仕組みを自社で設計できることが、次の競争優位になる。
              </p>
              <p className="mt-4 text-sm leading-7 text-[#EAF9FC]">
                分断された作業を統合し、AIを現場実装できる組織へ。
              </p>
              <p className="mt-auto pt-6 text-sm font-semibold text-[#E6FF00]">
                小さく始めて、確実に全社へ展開する。
              </p>
            </div>
          </div>
        )
      },
      {
        id: "slide-7",
        title: "MCP連携で、社内ツールをつなぐ",
        message:
          "MCPは、AIと業務ツールを安全に接続するための共通インターフェース",
        content: (
          <div className="grid h-full gap-5 md:grid-cols-[1.08fr_0.92fr]">
            <article className="h-full rounded-2xl border border-[#D9E1EB] bg-white p-6">
              <p className="heading-en text-xs font-semibold uppercase tracking-[0.12em] text-[#1FADC3]">
                MCPとは
              </p>
              <p className="mt-3 rounded-lg border border-[#D9E1EB] bg-[#F5F7FA] px-4 py-3 text-[15px] leading-7 text-[#556070]">
                MCP（Model Context Protocol）は、AIが外部システムと連携する際の
                共通規格です。接続先ごとに個別実装を増やすのではなく、
                同じ考え方でデータ取得・更新・操作を扱えるため、運用を標準化できます。
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[#333333]">
                {[
                  "接続方式を標準化し、拡張時の実装負荷を下げる",
                  "利用範囲を定義しやすく、運用ルールを設計しやすい",
                  "追加ツールにも段階的に連携を広げやすい"
                ].map((item) => (
                  <li
                    key={item}
                    className="rounded-lg border border-[#D9E1EB] bg-white px-4 py-3"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </article>
            <article className="h-full rounded-2xl border border-[#D9E1EB] bg-white p-6">
              <p className="heading-en text-xs font-semibold uppercase tracking-[0.12em] text-[#1FADC3]">
                Rezilでの連携イメージ
              </p>
              <div className="mt-4 space-y-3">
                {[
                  {
                    title: "Figma",
                    text: "UI/UX変更内容を開発タスクへ連携し、画面改善の反映速度を高める"
                  },
                  {
                    title: "Notion",
                    text: "議事録・業務手順・テンプレートを横断検索し、最新情報へすぐ到達できる"
                  },
                  {
                    title: "Slack",
                    text: "メンション・相談内容からタスク化候補を抽出し、対応漏れを減らす"
                  }
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-lg border border-[#D9E1EB] bg-[#F5F7FA] px-4 py-3"
                  >
                    <p className="text-base font-semibold text-[#333333]">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-[#556070]">{item.text}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 rounded-lg border border-[#1FADC3] bg-[#1FADC3] px-4 py-3 text-sm font-semibold leading-6 text-white">
                既存ツールを置き換えるのではなく、横断連携で価値を引き上げる。
              </p>
            </article>
          </div>
        )
      },
      {
        id: "slide-8",
        title: "具体例1: 現場点検報告の即時化",
        message:
          "写真撮影からPDF報告書出力までを現場で完結し、帰社後作業を削減する",
        content: (
          <div className="grid h-full gap-5 md:grid-cols-2">
            <article className="h-full rounded-2xl border border-[#D9E1EB] bg-white p-6">
              <p className="heading-en text-xs font-semibold uppercase tracking-[0.12em] text-[#1FADC3]">
                Current Operation
              </p>
              <h3 className="mt-3 text-xl font-bold text-[#333333]">
                現状: 帰社後に報告書を作成
              </h3>
              <ol className="mt-4 space-y-2.5 text-sm leading-6 text-[#556070]">
                {[
                  "現場で点検・撮影",
                  "事務所へ戻る",
                  "写真整理・内容確認",
                  "報告書を作成して提出"
                ].map((item, index) => (
                  <li
                    key={item}
                    className="rounded-lg border border-[#D9E1EB] bg-[#F5F7FA] px-4 py-2.5"
                  >
                    {index + 1}. {item}
                  </li>
                ))}
              </ol>
              <p className="mt-4 rounded-md border-l-4 border-[#E6FF00] bg-[#F5F7FA] px-4 py-3 text-sm leading-6 text-[#556070]">
                移動後の事務作業が増え、提出までの時間差と抜け漏れが発生しやすい。
              </p>
            </article>
            <article className="h-full rounded-2xl border border-[#D9E1EB] bg-white p-6">
              <p className="heading-en text-xs font-semibold uppercase tracking-[0.12em] text-[#1FADC3]">
                Proposed Operation
              </p>
              <h3 className="mt-3 text-xl font-bold text-[#333333]">
                提案: 現場で完結する報告フロー
              </h3>
              <div className="mt-4 space-y-1.5 text-sm">
                <div className="rounded-md border border-[#D9E1EB] bg-[#F5F7FA] px-4 py-2.5">
                  現場でツール起動・点検写真をアップロード
                </div>
                <div className="text-center text-[#1FADC3]">↓</div>
                <div className="rounded-md border border-[#D9E1EB] bg-[#F5F7FA] px-4 py-2.5">
                  必要項目を自動整形し、報告フォーマットへ反映
                </div>
                <div className="text-center text-[#1FADC3]">↓</div>
                <div className="rounded-md border border-[#D9E1EB] bg-[#F5F7FA] px-4 py-2.5">
                  その場でPDF出力・提出
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-[#333333]">
                {[
                  "帰社後の事務作業を圧縮",
                  "報告書提出のリードタイム短縮",
                  "記録漏れ・転記ミスの抑制"
                ].map((item) => (
                  <li key={item} className="rounded-md bg-[#EAF8FB] px-4 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        )
      },
      {
        id: "slide-9",
        title: "具体例2: 情報システム問い合わせの一次対応AI化",
        message:
          "Googleフォーム受付は維持し、AIが即返信・一次切り分け。高難易度のみ人へ連携する",
        content: (
          <div className="grid h-full gap-5 md:grid-cols-[1.05fr_0.95fr]">
            <article className="h-full rounded-2xl border border-[#D9E1EB] bg-white p-6">
              <p className="heading-en text-xs font-semibold uppercase tracking-[0.12em] text-[#1FADC3]">
                Hybrid Support Flow
              </p>
              <div className="mt-4 space-y-2 text-sm leading-6 text-[#333333]">
                {[
                  "Googleフォームで問い合わせ受付",
                  "AIエージェントが内容を分類し、即時に一次回答",
                  "既知トラブルは手順提示で自己解決を支援",
                  "未解決・重要案件は担当者へ自動エスカレーション"
                ].map((item, index) => (
                  <div
                    key={item}
                    className="rounded-lg border border-[#D9E1EB] bg-[#F5F7FA] px-4 py-2.5"
                  >
                    {index + 1}. {item}
                  </div>
                ))}
              </div>
              <p className="mt-4 rounded-md border border-[#1FADC3] bg-[#1FADC3] px-4 py-3 text-sm font-semibold leading-6 text-white">
                「即返信・即対応」を標準化し、滞留を減らす
              </p>
            </article>
            <article className="h-full rounded-2xl border border-[#D9E1EB] bg-white p-6">
              <p className="heading-en text-xs font-semibold uppercase tracking-[0.12em] text-[#1FADC3]">
                Human Escalation Criteria
              </p>
              <ul className="mt-4 space-y-2.5 text-sm leading-6">
                {[
                  "業務停止につながる高緊急案件",
                  "判断が必要な高難易度案件",
                  "セキュリティや権限変更を伴う案件"
                ].map((item) => (
                  <li
                    key={item}
                    className="rounded-lg border border-[#D9E1EB] bg-[#F5F7FA] px-4 py-2.5 text-[#556070]"
                  >
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-lg border border-[#D9E1EB] bg-white px-4 py-3">
                <p className="text-sm font-semibold text-[#333333]">期待効果</p>
                <ul className="mt-2 space-y-1.5 text-sm leading-6 text-[#556070]">
                  <li>・初動返信の短縮</li>
                  <li>・問い合わせ滞留の解消</li>
                  <li>・担当者の集中配分最適化</li>
                </ul>
              </div>
            </article>
          </div>
        )
      },
      {
        id: "slide-10",
        title: "変化に合わせて、運用を進化させる",
        message:
          "日々変わる現場要件にも、柔軟に対応できる仕組みへ",
        content: (
          <div className="grid h-full gap-6 md:grid-cols-[1fr_1fr]">
            <div className="h-full rounded-2xl border border-[#D9E1EB] bg-white p-6">
              <p className="heading-en text-xs font-semibold uppercase tracking-[0.12em] text-[#1FADC3]">
                Enablement Stack
              </p>
              <p className="mt-3 rounded-lg border-l-4 border-[#E6FF00] bg-[#F5F7FA] px-4 py-3 text-sm leading-7 text-[#556070]">
                Claude Code、Gemini、GASコード、ChatGPT、CodeX、Cursorを活用し、
                レジルの事業推進スピードを高める運用基盤を整備します。
              </p>
              <ul className="mt-4 space-y-3">
                {[
                  "社内で使いやすいUI/UX変更に応じた業務フロー更新",
                  "現場からの改善要望を反映した画面・帳票改善",
                  "AIプロンプトと検索対象の定期見直し",
                  "運用データをもとにした自動化範囲の拡張"
                ].map((item) => (
                  <li
                    key={item}
                    className="rounded-lg border border-[#D9E1EB] bg-[#F5F7FA] px-4 py-3 text-sm leading-6"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex h-full flex-col rounded-2xl border border-[#D9E1EB] bg-white p-6">
              <p className="heading-en text-xs font-semibold uppercase tracking-[0.12em] text-[#1FADC3]">
                Closing
              </p>
              <h3 className="mt-4 text-2xl font-bold leading-tight text-[#333333]">
                全社で、段階的に拡張できる土台を作る
              </h3>
              <p className="mt-4 rounded-lg border-l-4 border-[#E6FF00] bg-[#F5F7FA] px-4 py-3 text-sm leading-7 text-[#556070]">
                先日の Notion のイベントでは、上記のような改善を継続的に実施し、
                業務フローを柔軟に更新していくことの重要性が共有されていました。
              </p>
              <div className="mt-4 rounded-lg border border-[#D9E1EB] bg-[#F8FAFC] px-4 py-3">
                <p className="heading-en text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1FADC3]">
                  Success Metrics
                </p>
                <ul className="mt-2 space-y-1.5 text-sm leading-6 text-[#556070]">
                  {[
                    "報告書作成時間の短縮率",
                    "問い合わせ初動返信時間",
                    "未処理件数の推移",
                    "現場・管理部門の満足度"
                  ].map((item) => (
                    <li key={item}>・{item}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-5 rounded-lg border border-[#1FADC3] bg-[#1FADC3] px-4 py-3 text-sm font-semibold leading-7 text-white">
                AIエージェントを実装し、事務工数を削減しながら品質を上げる。
              </div>
              <p className="mt-4 rounded-lg border border-[#D9E1EB] bg-[#F8FAFC] px-4 py-3 text-sm leading-7 text-[#556070]">
                自社開発基盤が整えば、現在レジルで利用しているツール群は、
                段階的に代替していける可能性が高いと考えています。
              </p>
              <p className="mt-auto pt-6 text-lg font-semibold leading-8 text-[#1FADC3]">
                変化に追従できる業務基盤を、レジル標準として育てていく。
              </p>
            </div>
          </div>
        )
      }
    ],
    []
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const maxIndex = slides.length - 1;
  const currentSlide = slides[currentIndex];
  const isCoverSlide = currentSlide.isCover === true;

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, maxIndex));
  }, [maxIndex]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") goNext();
      if (event.key === "ArrowLeft") goPrev();
    };
    document.body.classList.add("presentation-mode");
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("presentation-mode");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [goNext, goPrev]);

  return (
    <main className="relative h-screen overflow-hidden bg-[#F5F7FA] text-[#333333]">
      <div className="presentation-grid-overlay pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#1FADC3]/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[#1FADC3]/15 blur-3xl"
        aria-hidden
      />

      <div className="absolute left-4 top-4 z-30 flex items-center gap-2.5 md:left-6 md:top-5">
        <Link
          href="/"
          className="focus-ring rounded-md border border-[#D9E1EB] bg-white px-3 py-2 text-sm font-medium"
        >
          トップへ
        </Link>
        <p className="heading-en hidden text-xs font-semibold uppercase tracking-[0.14em] text-[#1FADC3] md:block">
          Decarbonization x Digital x Design
        </p>
      </div>

      {!isCoverSlide ? (
        <div className="heading-en absolute right-4 top-4 z-30 rounded-md border border-[#D9E1EB] bg-white px-3 py-2 text-sm font-semibold md:right-6 md:top-5">
          {currentIndex + 1} / {slides.length}
        </div>
      ) : null}

      <section
        key={currentSlide.id}
        className="mx-auto flex h-screen w-full max-w-[1320px] flex-col px-4 pb-16 pt-16 md:px-7 md:pb-20 md:pt-20 lg:px-10"
      >
        {isCoverSlide ? (
          <article className="animate-slide-enter relative flex min-h-0 flex-1 overflow-hidden rounded-[30px] border border-[#7ad9e8] bg-gradient-to-br from-[#1098b2] via-[#1FADC3] to-[#82eaf8] shadow-[0_34px_80px_-34px_rgba(10,98,116,0.72)]">
            <div className="pointer-events-none absolute -left-12 -top-14 h-52 w-52 rounded-full bg-white/20 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-20 -right-12 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
            <div className="h-full w-full">{currentSlide.content}</div>
          </article>
        ) : (
          <article className="animate-slide-enter relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[26px] border border-[#D1DAE6] bg-white/92 shadow-[0_24px_60px_-36px_rgba(16,39,74,0.45)] backdrop-blur-sm">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#1FADC3] via-[#1FADC3] to-[#E6FF00]" />
            <header className="border-b border-[#E3E8F0] px-5 py-4 md:px-8 md:py-5">
              <div className="max-w-5xl space-y-2.5">
                <p className="heading-en text-xs font-semibold uppercase tracking-[0.16em] text-[#1FADC3]">
                  Slide {currentIndex + 1}
                </p>
                <h1 className="text-3xl font-bold leading-[1.12] text-[#333333] md:text-[2.45rem]">
                  {currentSlide.title}
                </h1>
                <p className="max-w-4xl rounded-md border-l-4 border-[#E6FF00] bg-[#F8FAFC] px-4 py-2.5 text-base leading-6 text-[#333333] md:text-[1.04rem] md:leading-7">
                  {currentSlide.message}
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1.5">
                {slides.map((slide, index) => {
                  const isActive = index === currentIndex;
                  const isPassed = index < currentIndex;
                  return (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => setCurrentIndex(index)}
                      aria-label={`${index + 1}枚目へ移動`}
                      className={`focus-ring h-2 rounded-full transition-all duration-300 ${
                        isActive
                          ? "w-10 bg-[#1FADC3]"
                          : isPassed
                            ? "w-5 bg-[#9ADAE4]"
                            : "w-5 bg-[#D9E1EB] hover:bg-[#B6C4D5]"
                      }`}
                    />
                  );
                })}
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-hidden px-4 py-4 md:px-7 md:py-5 lg:px-8">
              <div className="h-full overflow-hidden">{currentSlide.content}</div>
            </div>
          </article>
        )}
      </section>

      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2 md:bottom-8 md:right-8 md:gap-3">
        <button
          type="button"
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="focus-ring rounded-md border border-[#C7D3E1] bg-white px-4 py-2 text-sm font-semibold text-[#333333] shadow-sm transition-colors hover:bg-[#F5F7FA] disabled:cursor-not-allowed disabled:opacity-50"
        >
          戻る
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={currentIndex === maxIndex}
          className="focus-ring rounded-md border border-[#1FADC3] bg-[#1FADC3] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1298ad] disabled:cursor-not-allowed disabled:opacity-50"
        >
          次へ
        </button>
      </div>

      {!isCoverSlide ? (
        <p className="fixed bottom-5 left-5 z-30 rounded-md bg-white/85 px-3 py-2 text-xs text-[#556070] md:bottom-8 md:left-8">
          操作: 右下ボタン / キーボード左右キー / 上部バークリック
        </p>
      ) : null}
    </main>
  );
}
