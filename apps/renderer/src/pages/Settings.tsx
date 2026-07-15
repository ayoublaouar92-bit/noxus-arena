import {
  Settings as SettingsIcon,
  Building2,
  Clock,
  DollarSign,
  ShieldCheck,
} from "lucide-react";


export default function Settings() {

  return (

    <div className="p-6">


      <div className="flex items-center gap-3">


        <SettingsIcon
          size={32}
          className="text-purple-400"
        />


        <div>

          <h1 className="text-3xl font-bold text-white">
            Settings
          </h1>


          <p className="text-gray-400">
            Configure Noxus Arena system
          </p>

        </div>


      </div>




      <div className="grid grid-cols-2 gap-6 mt-8">


        <div className="
          bg-[#101018]
          border border-purple-500/20
          rounded-xl
          p-6
        ">


          <div className="flex items-center gap-3 mb-5">

            <Building2
              className="text-blue-400"
            />

            <h2 className="text-xl text-white font-bold">
              Arena Information
            </h2>

          </div>



          <div className="space-y-4">


            <div>

              <label className="text-gray-400 text-sm">
                Arena Name
              </label>

              <input
                value="Noxus Arena"
                readOnly
                className="
                w-full
                mt-2
                bg-black/30
                border border-white/10
                rounded-lg
                p-3
                text-white
                "
              />

            </div>



            <div>

              <label className="text-gray-400 text-sm">
                Currency
              </label>

              <input
                value="DZD"
                readOnly
                className="
                w-full
                mt-2
                bg-black/30
                border border-white/10
                rounded-lg
                p-3
                text-white
                "
              />

            </div>


          </div>


        </div>





        <div className="
          bg-[#101018]
          border border-purple-500/20
          rounded-xl
          p-6
        ">


          <div className="flex items-center gap-3 mb-5">


            <Clock
              className="text-cyan-400"
            />


            <h2 className="text-xl text-white font-bold">
              Pricing
            </h2>


          </div>




          <label className="text-gray-400 text-sm">
            Hour Price
          </label>


          <input
            value="200 DA"
            readOnly
            className="
            w-full
            mt-2
            bg-black/30
            border border-white/10
            rounded-lg
            p-3
            text-white
            "
          />



        </div>





        <div className="
          bg-[#101018]
          border border-purple-500/20
          rounded-xl
          p-6
        ">


          <div className="flex items-center gap-3">


            <ShieldCheck
              className="text-green-400"
            />


            <h2 className="text-xl text-white font-bold">
              System Status
            </h2>


          </div>


          <p className="text-green-400 mt-5">
            ● All Systems Operational
          </p>


        </div>



        <div className="
          bg-[#101018]
          border border-purple-500/20
          rounded-xl
          p-6
        ">


          <div className="flex items-center gap-3">


            <DollarSign
              className="text-yellow-400"
            />


            <h2 className="text-xl text-white font-bold">
              Version
            </h2>


          </div>


          <p className="text-gray-300 mt-5">
            Noxus Arena v1.0.0
          </p>


        </div>


      </div>


    </div>

  );

}