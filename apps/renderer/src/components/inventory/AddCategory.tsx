import { useState } from "react";


export default function AddCategory({
  onAdd,
}:{
  onAdd:(name:string)=>void;
}){


const [name,setName]=useState("");



function save(){

if(!name.trim())
return;


onAdd(name);

setName("");

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

Add Category

</h2>



<input

value={name}

onChange={
e=>setName(e.target.value)
}

placeholder="Category name"

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
text-white
py-3
rounded-lg
"

>

Save Category

</button>


</div>

);


}