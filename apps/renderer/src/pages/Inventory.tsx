import { useState } from "react";

import {
  Package,
  Folder,
  Trash2,
  Pencil,
  Boxes,
} from "lucide-react";


import AddCategory from "../components/inventory/AddCategory";
import AddProduct from "../components/inventory/AddProduct";
import EditProduct from "../components/inventory/EditProduct";
import StockMovement from "../components/inventory/StockMovement";



export default function Inventory(){



const [categories,setCategories]=useState([
"Drinks",
"Food",
"Snacks"
]);



const [products,setProducts]=useState<any[]>([

{
name:"Coca Cola",
category:"Drinks",
costPrice:"70",
sellPrice:"100",
stock:50,
image:""
}

]);



const [editing,setEditing]=useState<any>(null);

const [movement,setMovement]=useState<any>(null);







function addCategory(name:string){

setCategories([
...categories,
name
]);

}





function deleteCategory(name:string){

setCategories(
categories.filter(c=>c!==name)
);

}





function addProduct(product:any){

setProducts([
...products,
product
]);

}





function deleteProduct(index:number){

setProducts(
products.filter((_,i)=>i!==index)
);

}







function saveEdit(product:any){


setProducts(

products.map(p=>

p.name===editing.name

?

product

:

p

)

);


setEditing(null);


}







function updateMovement(updated:any){


setProducts(

products.map(p=>

p.name===updated.name

?

updated

:

p

)

);


setMovement(null);


}








return (

<div className="p-6">



<div className="
flex
items-center
gap-3
mb-8
">


<Package
size={36}
className="text-purple-400"
/>


<div>

<h1 className="
text-3xl
font-bold
text-white
">

Inventory

</h1>


<p className="text-gray-400">

Manage stock and products

</p>

</div>


</div>







<div className="
grid
grid-cols-2
gap-6
">


<AddCategory
onAdd={addCategory}
/>



<AddProduct

categories={categories}

onAdd={addProduct}

/>


</div>








<div className="mt-8">


<h2 className="
text-white
text-xl
font-bold
mb-4
">

Products

</h2>





<div className="space-y-5">


{

products.map((product,index)=>{


const profit =
Number(product.sellPrice)
-
Number(product.costPrice);



return (


<div

key={index}

className="
bg-[#101018]
border
border-purple-500/20
rounded-xl
p-5
"

>




<div className="
flex
gap-4
">


{

product.image ?

<img

src={product.image}

className="
w-28
h-28
rounded-xl
object-cover
"

/>


:

<div className="
w-28
h-28
bg-purple-500/10
rounded-xl
flex
items-center
justify-center
text-gray-400
">

No Image

</div>


}





<div className="flex-1">


<h3 className="
text-white
font-bold
text-xl
">

{product.name}

</h3>



<p className="text-purple-400">

{product.category}

</p>



<div className="
grid
grid-cols-4
mt-3
gap-3
text-sm
">


<div>
<p className="text-gray-400">
Cost
</p>
<p className="text-white">
{product.costPrice} DA
</p>
</div>



<div>
<p className="text-gray-400">
Sell
</p>
<p className="text-green-400">
{product.sellPrice} DA
</p>
</div>



<div>
<p className="text-gray-400">
Profit
</p>
<p className="text-purple-400">
{profit} DA
</p>
</div>



<div>
<p className="text-gray-400">
Stock
</p>
<p className="text-white">
{product.stock}
</p>
</div>



</div>



</div>


</div>








<div className="
flex
gap-5
mt-5
">


<button

onClick={()=>setEditing(product)}

className="text-blue-400 flex gap-2 items-center"

>

<Pencil size={16}/>

Edit

</button>




<button

onClick={()=>setMovement(product)}

className="text-purple-400 flex gap-2 items-center"

>

<Boxes size={16}/>

Stock Movement

</button>




<button

onClick={()=>deleteProduct(index)}

className="text-red-400 flex gap-2 items-center"

>

<Trash2 size={16}/>

Delete

</button>



</div>





</div>


);


})

}



</div>



</div>










{

editing &&

<EditProduct

product={editing}

onSave={saveEdit}

/>

}







{

movement &&

<div className="mt-6">


<StockMovement

product={movement}

onUpdate={updateMovement}

/>


</div>


}





</div>

);

}