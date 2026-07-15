import {
  Wallet,
  Clock,
  User,
  CreditCard,
} from "lucide-react";


const invoices = [
  {
    id: "#INV-001",
    player: "Ahmed",
    duration: "2 Hours",
    amount: "400 DA",
    status: "Paid",
  },
  {
    id: "#INV-002",
    player: "Youssef",
    duration: "1 Hour",
    amount: "200 DA",
    status: "Pending",
  },
  {
    id: "#INV-003",
    player: "Karim",
    duration: "3 Hours",
    amount: "600 DA",
    status: "Paid",
  },
  {
    id: "#INV-004",
    player: "Amine",
    duration: "45 Min",
    amount: "150 DA",
    status: "Pending",
  },
];


export default function Billing() {

  return (

    <div className="p-6">


      <div className="flex items-center gap-3">


        <Wallet
          size={32}
          className="text-purple-400"
        />


        <div>

          <h1 className="text-3xl font-bold text-white">
            Billing
          </h1>

          <p className="text-gray-400">
            Manage payments and invoices
          </p>

        </div>


      </div>




      <div className="grid grid-cols-3 gap-5 mt-8">


        <div className="bg-[#101018] border border-purple-500/20 rounded-xl p-5">

          <p className="text-gray-400">
            Today's Revenue
          </p>

          <h2 className="text-3xl font-bold text-white mt-2">
            12,450 DA
          </h2>

        </div>



        <div className="bg-[#101018] border border-purple-500/20 rounded-xl p-5">

          <p className="text-gray-400">
            Active Payments
          </p>

          <h2 className="text-3xl font-bold text-green-400 mt-2">
            18
          </h2>

        </div>



        <div className="bg-[#101018] border border-purple-500/20 rounded-xl p-5">

          <p className="text-gray-400">
            Hour Price
          </p>

          <h2 className="text-3xl font-bold text-blue-400 mt-2">
            200 DA
          </h2>

        </div>


      </div>





      <div className="mt-8 bg-[#101018] border border-purple-500/20 rounded-xl overflow-hidden">


        <table className="w-full text-left">


          <thead className="bg-purple-500/10 text-gray-300">

            <tr>

              <th className="p-4">
                Invoice
              </th>

              <th className="p-4">
                Player
              </th>

              <th className="p-4">
                Duration
              </th>

              <th className="p-4">
                Amount
              </th>

              <th className="p-4">
                Status
              </th>

            </tr>

          </thead>




          <tbody>


            {invoices.map((invoice)=>(

              <tr
                key={invoice.id}
                className="
                border-t border-white/5
                text-gray-300
                hover:bg-white/5
                transition
                "
              >


                <td className="p-4 flex items-center gap-2">

                  <CreditCard
                    size={18}
                    className="text-purple-400"
                  />

                  {invoice.id}

                </td>



                <td className="p-4 flex items-center gap-2">

                  <User
                    size={18}
                    className="text-blue-400"
                  />

                  {invoice.player}

                </td>



                <td className="p-4 flex items-center gap-2">

                  <Clock
                    size={18}
                    className="text-cyan-400"
                  />

                  {invoice.duration}

                </td>



                <td className="p-4 text-white font-bold">

                  {invoice.amount}

                </td>



                <td className="p-4">


                  <span
                    className={
                      invoice.status === "Paid"
                      ? "text-green-400"
                      : "text-yellow-400"
                    }
                  >

                    ● {invoice.status}

                  </span>


                </td>


              </tr>

            ))}


          </tbody>


        </table>


      </div>


    </div>

  );

}