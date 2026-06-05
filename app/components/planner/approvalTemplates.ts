import type { ApprovalRequestTemplate } from "./types";

export const APPROVAL_REQUEST_TEMPLATES: ApprovalRequestTemplate[] = [
  {
    id: "approval_plant_area_excavation",
    title: "植栽エリアの掘り返しについて",
    category: "植栽・掘削",
    body: "建物の安全を守るための接地（アース）補修工事ですが、植栽エリアの掘り返しを最小限に留め、植栽への影響が出ないよう、細心の注意を払って作業し、作業後は埋戻しと整地を行います。",
  },
  {
    id: "approval_ground_rod_noise",
    title: "接地棒打込み時の騒音について",
    category: "騒音・作業音",
    body: "接地棒の打ち込み時には一時的に金属打設音が発生いたしますが、短時間での完了に努め、近隣への騒音配慮を徹底いたします。",
  },
  {
    id: "approval_electrical_room_wall_hole",
    title: "電気室壁面への小穴あけについて",
    category: "電気室・穴あけ",
    body: "接地線を電気室内へ引込む為、歩道側の電気室壁面に小さい穴をあけます。",
  },
  {
    id: "approval_shortened_work_after_resistance_confirmed",
    title: "接地抵抗値確認後の作業短縮について",
    category: "接地抵抗・作業時間",
    body: "本工事は、規定の接地抵抗値が確認でき次第完了となります。測定値が速やかに基準を満たした際は、予定作業時間を短縮し、予定より早めに撤収させていただく場合がございます。",
  },
  {
    id: "approval_annual_outage_if_resistance_not_confirmed",
    title: "接地抵抗値が確認できない場合の対応について",
    category: "接地抵抗・停電年次",
    body: "本工事で規定の接地抵抗値が確認できなかった場合、停電年次点検の実施が必要となります。停電年次の時期につきましては改めて調整の上、お知らせいたします。",
  },
  {
    id: "approval_plant_excavation_no_compensation",
    title: "植栽部の掘削・補償について",
    category: "植栽・掘削",
    body: "電気設備の安全を守るための法律上定められた接地工事として、植栽部の掘削が必要です。施工時は丁寧な復旧に努めますが、根への影響により植物が枯れるリスクを完全には否定できず、その際の補償はいたしかねます。マンション全体の安全運行に不可欠な作業となりますので、何卒ご理解とご承認をお願い申し上げます。",
  },
  {
    id: "approval_bicycle_relocation",
    title: "自転車等の移動について",
    category: "車両・自転車移動",
    body: "工事の安全確保のため、指定範囲内の自転車等の移動をお願いいたします。未移動の車両は弊社で移動・復旧いたしますが、作業に伴う微細な傷等の判別や補償は致しかねます。安全な施工のためご理解とご協力をお願い申し上げます。",
  },
  {
    id: "approval_full_closure_vehicle_pedestrian",
    title: "車両・歩行者の全面通行止めについて",
    category: "通行規制",
    body: "図示Aの区間は、高所作業車による危険を伴う作業のため、期間中は車両・歩行者ともに全面通行止めとなります。安全確保を最優先とした措置でございます。恐れ入りますが、期間中は迂回ルートのご利用をお願い申し上げます。",
  },
  {
    id: "approval_vehicle_blocked_by_work_vehicle",
    title: "作業車両設置による車両通行不可について",
    category: "通行規制",
    body: "図示Aの区間は、作業車両の設置により車両の通行ができません。歩行者および自転車の押し歩きによる通行は可能です。お車をご利用の皆様にはご不便をおかけしますが、近隣の駐車場や迂回路のご確認をお願い申し上げます。",
  },
  {
    id: "approval_alternating_one_way_traffic",
    title: "片側交互通行について",
    category: "通行規制",
    body: "図示Aの区間は、作業車が道路の一部を占有するため、片側交互通行となります。現場誘導員の指示に従い、徐行での通行をお願いいたします。一時的な混雑が予想されますので、お時間に余裕を持って通行いただけますと幸いです。",
  },
  {
    id: "approval_cleaning_and_tidy_up",
    title: "清掃・片付けについて",
    category: "清掃・片付け",
    body: "安全を最優先に施工いたします。作業に伴いご不便をおかけする場合もございますが、終了後は速やかに清掃・片付けを行い、綺麗な状態で退去いたします。ご理解とご協力のほど、お願い申し上げます。",
  },
  {
    id: "approval_power_supply_vehicle_no_vehicle_move",
    title: "電源車設置・車両移動不可について",
    category: "電源車・駐車規制",
    body: "長時間停電を回避するための電源車等を、図示Aの箇所に配置いたします。安全確保のため、期間中の車両・自転車の移動と、新たな駐車の禁止をお願い申し上げます。なお、弊社での車両移動は行えません。万が一、当日対象箇所にお車がある場合は、安全上の理由から工事を中断または中止せざるを得ない場合がございます。円滑な施工のため、確実な周知とご協力をお願い申し上げます。",
  },
];

export const APPROVAL_REQUEST_TEMPLATE_MAP = new Map(
  APPROVAL_REQUEST_TEMPLATES.map((template) => [template.id, template] as const),
);
