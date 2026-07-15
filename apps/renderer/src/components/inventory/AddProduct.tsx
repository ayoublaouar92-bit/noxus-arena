import { useState } from "react";
import { ImagePlus } from "lucide-react";


export default function AddProduct({
  categories,
  onAdd
}:{
  categories:string[];
  onAdd:(product:any)=>void;
}){


const [name,setName]=useState("");
const [category,setCategory]=useState("");
const [costPrice,setCostPrice]=useState("");
const [sellPrice,setSellPrice]=useState("");
const [stock,setStock]=useState("");

const [image,setImage]=useState<string>("");




function chooseImage(e:any){

const file=e.target.files[0];

if(!file)
return;


const url = URL.createObjectURL(file);

setImage(url);

}




function save(){


onAdd({

name,
category,
costPrice,
sellPrice,
stock,
image

});


setName("");
setCategory("");
setCostPrice("");
setSellPrice("");
setStock("");
setImage("");

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
text-white
font-bold
text-xl
mb-4
">

Add Product

</h2>





<label className="
block
cursor-pointer
mb-4
">


<div className="
h-40
bg-black/30
rounded-xl
flex
items-center
justify-center
overflow-hidden
border
border-white/10
">


{

image ?

<img

src={image}

className="
w-full
h-full
object-cover
"

/>


:

<div className="
text-gray-400
flex
flex-col
items-center
gap-2
">

<ImagePlus size={35}/>

Choose Image

</div>


}



</div>




<input

type="file"

accept="image/*"

onChange={chooseImage}

className="hidden"

/>


</label>






<input

placeholder="Product name"

value={name}

onChange={
e=>setName(e.target.value)
}

className="
w-full
bg-black/30
text-white
p-3
rounded-lg
"

/>






<select

value={category}

onChange={
e=>setCategory(e.target.value)
}

className="
w-full
bg-black/30
text-white
p-3
rounded-lg
mt-3
"

>


<option>
Select Category
</option>


{

categories.map(c=>(

<option key={c}>

{c}

</option>

))

}


</select>






<input

placeholder="Cost Price"

value={costPrice}

onChange={
e=>setCostPrice(e.target.value)
}

className="
w-full
bg-black/30
text-white
p-3
rounded-lg
mt-3
"

/>






<input

placeholder="Selling Price"

value={sellPrice}

onChange={
e=>setSellPrice(e.target.value)
}

className="
w-full
bg-black/30
text-white
p-3
rounded-lg
mt-3
"

/>






<input

placeholder="Stock"

value={stock}

onChange={
e=>setStock(e.target.value)
}

className="
w-full
bg-black/30
text-white
p-3
rounded-lg
mt-3
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