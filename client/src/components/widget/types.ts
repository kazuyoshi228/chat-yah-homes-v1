/** デシジョンツリーのノード（chat_flow_nodes） */
export interface FlowNode {
  id: string;
  parentId: string | null;
  type: string; // "question" | "answer" | "redirect_form" | "redirect_ai"
  label: string; // JSON string {ja,en,ko,zh,th,vi}
  content: string | null; // JSON string
  options: string | null; // JSON array of child IDs
  icon: string | null;
  formTrigger: number;
  aiTrigger: number;
  sortOrder: number;
}
