import { ShoppingCart } from "lucide-react";


export default function Store(){

const products=[

{
name:"Coca Cola",
price:100,
stock:50,
image:""
},

{
name:"Burger",
price:500,
stock:20,
image:""
}

];



return (

<div className="p-6">


<div className="
flex
gap-3
items-center
mb-8
">

<ShoppingCart
className="text-purple-400"
/>


<h1 className="
text-3xl
font-bold
text-white
">

Store

</h1>


</div>





<div className="
grid
grid-cols-3
gap-5
">


{

products.map((product)=>(


<div

key={product.name}

className="
bg-[#101018]
border
border-purple-500/20
rounded-xl
p-5
"

>



<div className="
h-40
bg-black/30
rounded-xl
mb-4
flex
items-center
justify-center
text-gray-400
">

No Image

</div>




<h2 className="
text-white
font-bold
text-xl
">

{product.name}

</h2>



<p className="
text-green-400
mt-2
">

{product.price} DA

</p>




<button

className="
mt-4
w-full
bg-purple-500/30
text-white
py-3
rounded-lg
"

>

Buy

</button>



</div>


))


}



</div>


</div>

);

}