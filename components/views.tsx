import React from "react";

interface ViewsProps {
  slug: string;
  views: number;
}

const Views: React.FC<ViewsProps> = ({ slug }) => {
  // Lógica do componente usando o slug
  return <div>Views: {slug}</div>;
};

export default Views;
