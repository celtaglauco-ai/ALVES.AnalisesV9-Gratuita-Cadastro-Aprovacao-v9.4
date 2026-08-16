import type {Metadata,Viewport} from "next";import "./globals.css";import "./additions.css";import "./mobile.css";
export const metadata:Metadata={title:"ALVES.AnalisesV11",description:"Análises estatísticas, classificações, árbitros, pré-jogo, ao vivo e IA"};
export const viewport:Viewport={width:"device-width",initialScale:1,maximumScale:5,viewportFit:"cover",themeColor:"#07101d"};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
