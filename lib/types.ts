export type Game={home:string;away:string;hg:number;ag:number;hc:number;ac:number;hy:number;ay:number;hr:number;ar:number;hs:number;as:number;hst:number;ast:number};
export type League={id:string;code:string;country:string;name:string;season:string;fileName?:string;updatedAt:number;games:Game[]};
