import type {Metadata,Viewport} from "next";import "./globals.css";import "./additions.css";import "./performance.css";import "./v12.css";import "./mobile.css";
export const metadata:Metadata={title:"ALVES.AnalisesV12",description:"Plataforma segura de análises estatísticas, histórico pessoal e administração completa"};
export const viewport:Viewport={width:"device-width",initialScale:1,maximumScale:5,viewportFit:"cover",themeColor:"#07101d"};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
