import type {Metadata} from "next";import "./globals.css";import "./additions.css";
export const metadata:Metadata={title:"ALVES.AnalisesV11",description:"Análises estatísticas, classificações, árbitros, pré-jogo, ao vivo e IA"};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
