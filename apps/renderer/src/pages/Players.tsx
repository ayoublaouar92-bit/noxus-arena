import { useState } from "react";
import {
  Users,
  UserPlus,
  Trash2,
  Wallet,
} from "lucide-react";



export default function Players(){


const [players,setPlayers]=useState<any[]>([]);



const [name,setName]=useState("");
const [username,setUsername]=useState("");
const [phone,setPhone]=useState("");
const [balance,setBalance]=useState("");
const [image,setImage]=useState("");





function chooseImage(e:any){

const file=e.target.files[0];

if(!file)
return;


setImage(
URL.createObjectURL(file)
);

}





function addPlayer(){


setPlayers([

...players,

{
name,
username,
phone,
balance,
image
}

]);



setName("");
setUsername("");
setPhone("");
setBalance("");
setImage("");

}






function deletePlayer(index:number){

setPlayers(

players.filter(
(_,i)=>i!==index
)

);

}







return (

<div className="p-6">





<div className="
flex
items-center
gap-3
mb-8
">


<Users

size={36}

className="text-purple-400"

/>


<div>


<h1 className="
text-3xl
font-bold
text-white
">

Players

</h1>


<p className="
text-gray-400
">

Members management

</p>


</div>


</div>









<div className="
grid
grid-cols-2
gap-6
">





{/* ADD MEMBER */}



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
flex
gap-2
items-center
">

<UserPlus size={20}/>

Add Player

</h2>





<label className="
block
cursor-pointer
mb-4
">


<div className="
h-36
rounded-xl
bg-black/30
flex
items-center
justify-center
overflow-hidden
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

<span className="
text-gray-400
">

Choose Photo

</span>


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

placeholder="Full Name"

value={name}

onChange={e=>setName(e.target.value)}

className="
w-full
p-3
rounded-lg
bg-black/30
text-white
"

/>






<input

placeholder="Username"

value={username}

onChange={e=>setUsername(e.target.value)}

className="
w-full
p-3
rounded-lg
bg-black/30
text-white
mt-3
"

/>






<input

placeholder="Phone"

value={phone}

onChange={e=>setPhone(e.target.value)}

className="
w-full
p-3
rounded-lg
bg-black/30
text-white
mt-3
"

/>







<input

placeholder="Balance / Debt"

value={balance}

onChange={e=>setBalance(e.target.value)}

className="
w-full
p-3
rounded-lg
bg-black/30
text-white
mt-3
"

/>







<button

onClick={addPlayer}

className="
mt-4
w-full
bg-purple-500/30
text-white
py-3
rounded-lg
"

>

Add Player

</button>





</div>









{/* PLAYERS LIST */}





<div className="
bg-[#101018]
border
border-purple-500/20
rounded-xl
p-5
">


<h2 className="
text-xl
font-bold
text-white
mb-5
">

Members

</h2>





<div className="space-y-4">



{

players.map((player,index)=>(


<div

key={index}

className="
bg-white/5
rounded-xl
p-4
flex
items-center
justify-between
"

>




<div className="
flex
gap-4
items-center
">



{

player.image ?

<img

src={player.image}

className="
w-16
h-16
rounded-full
object-cover
"

/>


:

<div className="
w-16
h-16
rounded-full
bg-purple-500/20
flex
items-center
justify-center
text-white
">

?


</div>


}





<div>


<h3 className="
text-white
font-bold
">

{player.name}

</h3>


<p className="
text-purple-400
">

@{player.username}

</p>


<p className="
text-gray-400
">

{player.phone}

</p>


</div>



</div>







<div className="
flex
items-center
gap-4
">


<div className="
flex
items-center
gap-1
text-yellow-400
">

<Wallet size={18}/>

{player.balance} DA

</div>



<button

onClick={()=>deletePlayer(index)}

className="
text-red-400
"

>

<Trash2 size={18}/>

</button>



</div>





</div>


))


}



</div>




</div>




</div>




</div>

);

}