export type IdeaOutline = {
  gatilho: string;
  tese: string;
  argumento_principal: string;
  historico: string;
  contraponto: string;
  implicacao: string;
  provocacao: string;
};

export type Idea = {
  _id: string;
  userId: string;
  title: string;
  gatilhoTipo: string;
  gatilho: string;
  tags: string[];
  notas: string;
  outline: IdeaOutline | null;
  outlineAt: string | null;
  createdAt: string;
};

export type ChecklistRespostas = {
  gatilho: "sim" | "parcial" | "não";
  tese: "sim" | "parcial" | "não";
  contraponto: "sim" | "parcial" | "não";
  evidencia: "sim" | "parcial" | "não";
  principio: "sim" | "parcial" | "não";
  falseavel: "sim" | "parcial" | "não";
  provocacao: "sim" | "parcial" | "não";
  audiencia: "sim" | "parcial" | "não";
};
