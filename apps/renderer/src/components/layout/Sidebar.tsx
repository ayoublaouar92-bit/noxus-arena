import {

LayoutDashboard,
Monitor,
Gamepad2,
Users,
CreditCard,
BarChart3,
Settings,
ShoppingCart,
Package

} from "lucide-react";



const menu=[


{
name:"Dashboard",
icon:LayoutDashboard
},


{
name:"Devices",
icon:Monitor
},


{
name:"Sessions",
icon:Gamepad2
},


{
name:"Players",
icon:Users
},


{
name:"Inventory",
icon:Package
},


{
name:"Store",
icon:ShoppingCart
},


{
name:"Billing",
icon:CreditCard
},


{
name:"Reports",
icon:BarChart3
},


{
name:"Settings",
icon:Settings
}


];





export default function Sidebar({

page,
setPage

}:{

page:string;

setPage:(page:string)=>void;

}){


return (

<aside className="
w-64
min-h-screen
bg-[#07070B]
border-r
border-purple-500/20
p-5
">


<div className="mb-10">


<h1 className="
text-2xl
font-bold
text-purple-400
">

⚔ NOXUS ARENA

</h1>



<p className="
text-xs
text-blue-300
mt-1
">

Cyber Command Center

</p>


</div>





<nav className="
space-y-2
">


{

menu.map(item=>{


const Icon=item.icon;



return (


<div

key={item.name}

onClick={()=>setPage(item.name)}

className={`

flex
items-center
gap-3
px-4
py-3
rounded-xl
cursor-pointer
transition-all


${

page===item.name

?

"bg-purple-500/20 text-white border border-purple-500/40 shadow-lg shadow-purple-500/10"

:

"text-gray-400 hover:text-white hover:bg-white/5"

}

`}

>


<Icon size={20}/>


<span>

{item.name}

</span>



</div>


)


})


}



</nav>



</aside>

);


}