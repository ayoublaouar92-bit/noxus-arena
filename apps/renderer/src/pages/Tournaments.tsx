import {
  Trophy,
  Users,
  Gamepad2,
  Calendar,
} from "lucide-react";


const tournaments = [
  {
    name: "Noxus Championship",
    game: "Valorant",
    mode: "5 VS 5",
    teams: "8 Teams",
    status: "Active",
  },
  {
    name: "Arena Clash",
    game: "Counter Strike 2",
    mode: "3 VS 3",
    teams: "16 Teams",
    status: "Registration",
  },
  {
    name: "Solo Battle",
    game: "FC 26",
    mode: "1 VS 1",
    teams: "32 Players",
    status: "Coming Soon",
  },
];


export default function Tournaments() {

  return (

    <div className="p-6">


      <div className="flex items-center gap-3">


        <Trophy
          size={32}
          className="text-yellow-400"
        />


        <div>

          <h1 className="text-3xl font-bold text-white">
            Tournaments
          </h1>

          <p className="text-gray-400">
            Create and manage gaming competitions
          </p>

        </div>


      </div>




      <div className="grid grid-cols-3 gap-5 mt-8">


        {tournaments.map((tournament)=>(


          <div
            key={tournament.name}
            className="
            bg-[#101018]
            border border-purple-500/20
            rounded-xl
            p-5
            hover:border-purple-400/50
            transition
            "
          >


            <div className="flex justify-between">


              <Trophy
                className="text-yellow-400"
              />


              <span className="text-green-400 text-sm">
                ● {tournament.status}
              </span>


            </div>



            <h2 className="text-xl font-bold text-white mt-4">

              {tournament.name}

            </h2>




            <div className="mt-4 space-y-3 text-gray-300">


              <p className="flex gap-2 items-center">

                <Gamepad2 size={18}
                className="text-purple-400"/>

                {tournament.game}

              </p>



              <p className="flex gap-2 items-center">

                <Users size={18}
                className="text-blue-400"/>

                {tournament.mode}

              </p>



              <p className="flex gap-2 items-center">

                <Calendar size={18}
                className="text-cyan-400"/>

                {tournament.teams}

              </p>


            </div>



            <button
              className="
              mt-5
              w-full
              bg-purple-500/20
              hover:bg-purple-500/40
              text-white
              py-2
              rounded-lg
              transition
              "
            >

              Manage Tournament

            </button>


          </div>


        ))}


      </div>


    </div>

  );

}