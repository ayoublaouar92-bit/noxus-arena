import { useState } from "react";
import { ImagePlus } from "lucide-react";


export default function EditProduct({
product,
onSave
}:{
product:any;
onSave:(p:any)=>void;
}){


const [data,setData]=useState(product);



function chooseImage(e:any){

const file=e.target.files[0];

if(!file)
return;


const url=URL.createObjectURL(file);


setData({

...data,

image:url

});


}





return (

<div className="
bg-[#101018]
border
border-purple-500/30
rounded-xl
p-5
">


<h2 className="
text-white
font-bold
text-xl
mb-4
">

Edit Product

</h2>





<label className="
block
cursor-pointer
mb-4
">


<div className="
h-40
rounded-xl
bg-black/30
overflow-hidden
flex
items-center
justify-center
border
border-white/10
">


{

data.image ?

<img

src={data.image}

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

Change Image

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

value={data.name}

onChange={
e=>setData({
...data,
name:e.target.value
})
}

className="
w-full
bg-black/30
text-white
p-3
rounded-lg
"

/>






<input

value={data.costPrice}

onChange={
e=>setData({
...data,
costPrice:e.target.value
})
}

placeholder="Cost Price"

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

value={data.sellPrice}

onChange={
e=>setData({
...data,
sellPrice:e.target.value
})
}

placeholder="Selling Price"

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

value={data.stock}

onChange={
e=>setData({
...data,
stock:e.target.value
})
}

placeholder="Stock"

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

onClick={()=>onSave(data)}

className="
mt-4
w-full
bg-green-500/30
hover:bg-green-500/50
text-white
py-3
rounded-lg
"

>

Save Changes

</button>



</div>

);

}