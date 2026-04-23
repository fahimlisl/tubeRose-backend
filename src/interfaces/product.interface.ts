export interface IProduct extends Document{
    title:string;
    category:string,
    description:string,
    image:{
        url:string,
        public_id:string,
        isThumbnail:Boolean
    }[];
    skinType:string[];
    sizes:sizeVariant[];
    productDetails:productDetails[]
}

export interface sizeVariant {
    label:string;
    unit:string;
    basePrice?:number;
    finalPrice:number;
    stock:number
}

export interface productDetails {
    title:string
}