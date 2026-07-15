import {
  BarChart3,
  TrendingUp,
  Users,
  Monitor,
  Gamepad2,
} from "lucide-react";


const reports = [
  {
    title: "Total Revenue",
    value: "185,400 DA",
    icon: TrendingUp,
  },
  {
    title: "Total Sessions",
    value: "642",
    icon: Gamepad2,
  },
  {
    title: "Active Players",
    value: "146",
    icon: Users,
  },
  {
    title: "Devices Usage",
    value: "92%",
    icon: Monitor,
  },
];


export default function Reports() {

  return (

    <div className="p-6">


      <div className="flex items-center gap-3">

        <BarChart3
          size={32}
          className="text-purple-400"
        />

        <div>

          <h1 className="text-3xl font-bold text-white">
            Reports
          </h1>

          <p className="text-gray-400">
            Analyze Noxus Arena performance
          </p>

        </div>

      </div>



      <div className="grid grid-cols-4 gap-5 mt-8">


        {reports.map((item)=>{

          const Icon = item.icon;


          return (

            <div
              key={item.title}
              className="
              bg-[#101018]
              border border-purple-500/20
              rounded-xl
              p-5
              "
            >

              <div className="flex justify-between">

                <span className="text-gray-400">
                  {item.title}
                </span>


                <Icon
                  className="text-purple-400"
                />

              </div>


              <h2 className="text-3xl font-bold text-white mt-4">

                {item.value}

              </h2>


            </div>

          );

        })}


      </div>



      <div className="
        mt-8
        bg-[#101018]
        border border-purple-500/20
        rounded-xl
        p-6
      ">


        <h2 className="text-xl font-bold text-white mb-5">
          Weekly Activity
        </h2>


        <div className="space-y-4">


          {[
            ["Monday","82 Sessions"],
            ["Tuesday","96 Sessions"],
            ["Wednesday","110 Sessions"],
            ["Thursday","140 Sessions"],
            ["Friday","124 Sessions"],
          ].map((day)=>(


            <div
              key={day[0]}
              className="
              flex
              justify-between
              text-gray-300
              border-b border-white/5
              pb-3
              "
            >

              <span>
                {day[0]}
              </span>


              <span className="text-purple-400">
                {day[1]}
              </span>


            </div>


          ))}


        </div>


      </div>


    </div>

  );

}