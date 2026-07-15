import { useState } from "react";


export default function AddProduct({
  categories,
  onAdd,
}:{
  categories:string[];
  onAdd:(product:any)=>void;
}){


const [name,setName]=useState("");
const [category,setCategory]=useState("");
const [price,setPrice]=useState("");
const [stock,setStock]=useState("");



function save(){

onAdd({

name,
category,
price,
stock

});


setName("");
setPrice("");
setStock("");

}



return (

<div className="
bg-[#101018]
border
border-purple-500/20
rounded-xl
p-5
">


<h2 className="
text-xl
text-white
font-bold
mb-4
">

Add Product

</h2>



<input
placeholder="Product name"
value={name}
onChange={e=>setName(e.target.value)}
className="
w-full
bg-black/30
text-white
p-3
rounded-lg
mb-3
"
/>



<select
value={category}
onChange={e=>setCategory(e.target.value)}
className="
w-full
bg-black/30
text-white
p-3
rounded-lg
mb-3
"
>


<option>
Select Category
</option>


{categories.map(c=>(

<option key={c}>
{c}
</option>

))}


</select>




<input
placeholder="Price"
value={price}
onChange={e=>setPrice(e.target.value)}
className="
w-full
bg-black/30
text-white
p-3
rounded-lg
mb-3
"
/>



<input
placeholder="Stock"
value={stock}
onChange={e=>setStock(e.target.value)}
className="
w-full
bg-black/30
text-white
p-3
rounded-lg
"
/>




<button

onClick={save}

className="
mt-4
w-full
bg-purple-500/30
hover:bg-purple-500/50
text-white
py-3
rounded-lg
"

>

Save Product

</button>


</div>

);

}