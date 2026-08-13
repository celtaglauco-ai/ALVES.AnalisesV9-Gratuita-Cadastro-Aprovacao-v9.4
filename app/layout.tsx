import type {Metadata} from "next";import "./globals.css";
export const metadata:Metadata={title:"ALVES.AnalisesV10",description:"Análises estatísticas de futebol pré-jogo, ao vivo e por IA"};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
