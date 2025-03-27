"use client";

import { useState } from "react";
import { EllipsisVerticalIcon, XMarkIcon } from "@heroicons/react/20/solid";
import {
  useUser,  
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton, 
} from "@clerk/nextjs";	

export default function SettingsMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed">
      {/* Botão de três pontos */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-gray-900 text-gray-300 rounded-full p-2 shadow-lg hover:bg-gray-700"
        aria-label={isOpen ? "Fechar configurações" : "Abrir configurações"}
      >
        {isOpen ? (
          <XMarkIcon className="w-6 h-6" />
        ) : (
          <EllipsisVerticalIcon className="w-6 h-6" />
        )}
      </button>

      {/* Modal de configurações posicionado abaixo e à direita do botão */}
      {isOpen && (
        <div className="fixed top-12 right-0 h-[50vh] max-h-[400px] w-80 bg-gray-900 rounded-lg shadow-lg z-50">
          <div className="flex flex-col h-full">
            {/* Cabeçalho do modal */}
            <div className="bg-gray-700 p-4 flex justify-between items-center rounded-t-lg">
              <h3 className="text-lg font-semibold text-zinc-100">Configurações</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-300 hover:text-gray-100"
                aria-label="Fechar configurações"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Área de configurações (fictícias) */}
            <div
              className="flex-1 p-6 bg-gray-800 overflow-y-auto space-y-4 scrollbar-none"
              style={{ scrollbarWidth: "none" }}
            >
              <style jsx>{`
                .scrollbar-none::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-zinc-100">Tema do Blog</h4>
                  <p className="text-xs text-gray-400">
                    Escolha entre o tema claro ou escuro para personalizar sua experiência.
                  </p>
                  <div className="mt-2 flex gap-2">
                  </div>
                </div>

                <div>
                  <h1 className="p-1 text-2xl font-medium">Logar</h1>
                      <SignInButton>
                        <button className="bg-gray-600 text-gray-300 rounded-lg px-3 py-1 text-sm hover:bg-gray-500">
                          Ativar
                        </button>
                      </SignInButton>
                  <div className="mt-2 flex gap-2">
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-zinc-100">Idioma</h4>
                  <p className="text-xs text-gray-400">
                    Selecione o idioma preferido para o blog.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button className="bg-gray-600 text-gray-300 rounded-lg px-3 py-1 text-sm hover:bg-gray-500">
                      Português
                    </button>
                    <button className="bg-gray-600 text-gray-300 rounded-lg px-3 py-1 text-sm hover:bg-gray-500">
                      Inglês
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Rodapé */}
            <div className="p-4 bg-gray-800 border-t border-gray-700 rounded-b-lg">
              <p className="text-xs text-gray-500 text-center">
                Configurações salvas automaticamente
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}