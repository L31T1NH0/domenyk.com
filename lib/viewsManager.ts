import { useState, useEffect } from "react";
import axios, { AxiosResponse } from "axios"; // Importe AxiosResponse para tipagem

export interface ViewResponse {
  message: string;
  views: number;
}

export function useViews(
  postId: string | string[] | undefined,
  initialViews: number = 0
) {
  // Garante que postId é uma string
  const id = typeof postId === "string" ? postId : (postId && postId[0]) || "";

  // Estado para as views, inicializado com o valor inicial do servidor
  const [views, setViews] = useState<number>(initialViews);

  // Função para atualizar as views (chamada manualmente ou via efeito), retornando a resposta
  const updateViews = async (): Promise<AxiosResponse<ViewResponse>> => {
    if (!id) return Promise.reject(new Error("Post ID is undefined"));

    try {
      const cookieName = `viewed_${id}`;
      const hasViewed = document.cookie.includes(`${cookieName}=true`);

      if (!hasViewed) {
        const response = await axios.post<ViewResponse>(`/api/views/${id}`);
        console.log(
          "Response from backend for views (updateViews):",
          response.data,
          "Headers:",
          response.headers
        );
        if (
          response.data.message === "View count updated" ||
          response.data.message === "Post created with 1 view"
        ) {
          setViews(response.data.views);
        } else if (
          response.data.message === "View not updated (already viewed)"
        ) {
          console.log("User already viewed this post, no update made.");
          setViews(response.data.views || initialViews);
        }
        document.cookie = `${cookieName}=true; max-age=86400; path=/; domain=${window.location.hostname}; SameSite=Strict`;
        return response; // Retorna a resposta da requisição
      }

      // Se já visualizado, apenas retorna as views atuais sem chamar a API
      const currentViews = await axios.post<ViewResponse>(`/api/views/${id}`);
      setViews(currentViews.data.views || initialViews);
      return Promise.resolve({
        data: {
          message: "View already counted",
          views: currentViews.data.views || initialViews,
        },
        status: 200,
        statusText: "OK",
        headers: {},
        config: {},
      } as AxiosResponse<ViewResponse>);
    } catch (error: any) {
      console.error("Failed to update post view count. Error details:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers,
      });
      throw error; // Lança o erro para ser capturado no catch do caller
    }
  };

  // Efeito para atualizar as views ao montar o componente, mesmo em acessos diretos
  useEffect(() => {
    console.log(
      "useViews initialized with id:",
      id,
      "initialViews:",
      initialViews,
      "current views:",
      views
    );
    if (id) {
      updateViews().catch((error) =>
        console.error("Failed to initialize views on load:", error)
      );
    }
  }, [id, initialViews]);

  return { views, updateViews };
}
