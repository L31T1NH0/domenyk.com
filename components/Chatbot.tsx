"use client";

import { useState, useEffect, useRef } from "react";
import { ChatBubbleLeftIcon, XMarkIcon } from "@heroicons/react/20/solid";
import {
  useUser,  
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton, 
} from "@clerk/nextjs";	
import Link from "next/link";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatbotProps = {
  htmlContent: string;
};

export default function Chatbot({ htmlContent }: ChatbotProps) {
  const { isSignedIn, user } = useUser();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const userMessage: ChatMessage = { role: "user", content: message };
    setMessages((prev) => [...prev, userMessage]);
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, htmlContent }),
      });

      const data = await res.json();
      if (data.error) {
        const errorMessage: ChatMessage = { role: "assistant", content: "Erro: " + data.error };
        setMessages((prev) => [...prev, errorMessage]);
      } else {
        const assistantMessage: ChatMessage = { role: "assistant", content: data.reply };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      const errorMessage: ChatMessage = { role: "assistant", content: "Erro ao se comunicar com o Grok." };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      {/* Botão do Chatbot */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 bg-gray-900 text-gray-300 rounded-full p-4 shadow-lg hover:bg-gray-700 z-50"
        aria-label={isOpen ? "Fechar chat com Grok" : "Abrir chat com Grok"}
      >
        {isOpen ? (
          <XMarkIcon className="w-6 h-6" />
        ) : (
          <ChatBubbleLeftIcon className="w-6 h-6" />
        )}
      </button>

      {/* Modal do Chatbot posicionado acima e à esquerda do botão */}
      {isOpen && (
        !isSignedIn ? (
          <div className="fixed bottom-16 mb-6 right-6 h-[75vh] max-h-[600px] w-96 bg-gray-900 rounded-lg shadow-lg z-50">
            <div className="flex flex-col h-full">
              <div className="bg-gray-700 p-4 flex justify-between items-center rounded-t-lg">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-zinc-100">Grok</h3>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-300 hover:text-gray-100"
                  aria-label="Fechar chat"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 rounded rounded-t-none p-6 bg-gray-800 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <p className="text-sm mb-4">
                    Você precisa estar logado para usar o chat com o Grok.
                  </p>
                  <SignInButton>                  
                    <button className="bg-gray-600 text-gray-300 rounded-lg px-4 py-2 hover:bg-gray-500">
                      Fazer Login
                    </button>
                  </SignInButton>

                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="fixed mb-6 bottom-16 right-6 h-[75vh] max-h-[600px] w-96 bg-gray-900 rounded-lg shadow-lg z-50">
            <div className="flex flex-col h-full">
              <div className="bg-gray-700 p-4 flex justify-between items-center rounded-t-lg">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-zinc-100">Grok</h3>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-300 hover:text-gray-100"
                  aria-label="Fechar chat"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div
                ref={chatContainerRef}
                className="flex-1 p-6 bg-gray-800 overflow-y-auto space-y-4 scrollbar-none"
                style={{ scrollbarWidth: "none" }}
              >
                <style jsx>{`
                  .scrollbar-none::-webkit-scrollbar {
                    display: none;
                  }
                `}</style>
                {messages.length === 0 ? (
                  <p className="text-gray-400 text-center text-sm">
                    Olá, {user?.firstName}! Estou aqui para ajudar com o conteúdo do post. O que você gostaria de saber?
                  </p>
                ) : (
                  messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] p-3 rounded-2xl ${
                          msg.role === "user"
                            ? "bg-gray-600 text-zinc-100"
                            : "bg-gray-700 text-zinc-300"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 bg-gray-800 border-t border-gray-700 rounded-b-lg">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Digite sua pergunta..."
                    className="flex-1 p-2 rounded-lg bg-gray-700 text-zinc-300 focus:outline-none focus:ring-2 focus:ring-gray-600 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-gray-600 text-gray-300 rounded-lg p-2 hover:bg-gray-500 disabled:opacity-50"
                  >
                    {loading ? (
                      <svg
                        className="animate-spin h-5 w-5 text-gray-300"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        ></path>
                      </svg>
                    ) : (
                      "Enviar"
                    )}
                  </button>
                </form>
                <p className="text-xs text-gray-500 text-center mt-2">
                  Powered by xAI
                </p>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}