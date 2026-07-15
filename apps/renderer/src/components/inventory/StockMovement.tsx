import { useState } from "react";


export default function StockMovement({
product,
onUpdate
}:{
product:any;
onUpdate:(data:any)=>void;
}){


const [quantity,setQuantity]=useState("");
const [type,setType]=useState("add");
const [reason,setReason]=useState("");



function save(){


const qty = Number(quantity);



let newStock =
Number(product.stock);



if(type==="add"){

newStock += qty;

}

else{

newStock -= qty;

}




onUpdate({

...product,

stock:newStock,

movement:[
...(product.movement || []),

{
type,
quantity:qty,
reason,
date:new Date().toLocaleDateString()
}

]

});



setQuantity("");
setReason("");

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
mb-4
">

Stock Movement

</h2>



<select

value={type}

onChange={
e=>setType(e.target.value)
}

className="
w-full
bg-black/30
text-white
p-3
rounded-lg
"

>

<option value="add">
Add Stock
</option>


<option value="remove">
Remove Stock
</option>


</select>




<input

placeholder="Quantity"

value={quantity}

onChange={
e=>setQuantity(e.target.value)
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

placeholder="Reason"

value={reason}

onChange={
e=>setReason(e.target.value)
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
text-white
py-3
rounded-lg
"

>

Save Movement

</button>



</div>

);

}