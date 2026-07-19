import { useState } from "react";

import { Users, Search, UserPlus, Trash2, Wallet } from "lucide-react";
import { useLanguage } from "../lib/i18n";

export default function Members() {
  const { dir, language } = useLanguage();
  const tr = (en: string, ar: string, fr: string) =>
    language === "ar" ? ar : language === "fr" ? fr : en;

  const [members, setMembers] = useState<any[]>([
    {
      id: 1,
      name: "Ayoub",
      nickname: "Noxus",
      phone: "0550000000",
      balance: 500,
      debt: 0,
      hours: 25,
      spent: 2500,
    },
  ]);

  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");

  const [search, setSearch] = useState("");

  function addMember() {
    if (!name || !nickname) return;

    setMembers([
      ...members,

      {
        id: Date.now(),

        name,

        nickname,

        phone,

        balance: 0,

        debt: 0,

        hours: 0,

        spent: 0,
      },
    ]);

    setName("");
    setNickname("");
    setPhone("");
  }

  function deleteMember(id: number) {
    setMembers(members.filter((m) => m.id !== id));
  }

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.nickname.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6">
      <div
        className="
flex
items-center
gap-3
mb-8
"
      >
        <Users
          size={36}

          className="text-purple-400"
        />

        <div>
          <h1
            className="
text-3xl
font-bold
text-white
"
          >
            Members Database
          </h1>

          <p
            className="
text-gray-400
"
          >
            Players accounts and financial records
          </p>
        </div>
      </div>

      <div
        className="
grid
grid-cols-3
gap-6
"
      >
        {/* ADD MEMBER */}

        <div
          className="
bg-[#101018]
border
border-purple-500/20
rounded-xl
p-5
"
        >
          <h2
            className="
text-white
font-bold
text-xl
flex
items-center
gap-2
mb-5
"
          >
            <UserPlus size={20} />
            Add Member
          </h2>

          <input
            placeholder={tr("Full name", "الاسم الكامل", "Nom complet")}

            value={name}

            onChange={(e) => setName(e.target.value)}

            className="
w-full
bg-black/30
p-3
rounded-lg
text-white
"
          />

          <input
            placeholder={tr("Gaming name", "اسم اللعب", "Nom de jeu")}

            value={nickname}

            onChange={(e) => setNickname(e.target.value)}

            className="
w-full
bg-black/30
p-3
rounded-lg
text-white
mt-3
"
          />

          <input
            placeholder={tr("Phone", "الهاتف", "Téléphone")}

            value={phone}

            onChange={(e) => setPhone(e.target.value)}

            className="
w-full
bg-black/30
p-3
rounded-lg
text-white
mt-3
"
          />

          <button
            onClick={addMember}

            className="
mt-4
w-full
bg-purple-500/30
hover:bg-purple-500/50
text-white
py-3
rounded-lg
"
          >
            Create Member
          </button>
        </div>

        {/* MEMBERS LIST */}

        <div
          className="
col-span-2
bg-[#101018]
border
border-purple-500/20
rounded-xl
p-5
"
        >
          <div
            className="
flex
items-center
gap-3
bg-black/30
p-3
rounded-lg
mb-5
"
          >
            <Search className="text-gray-400" />

            <input
              placeholder={tr(
                "Search member...",
                "ابحث عن عضو...",
                "Rechercher un membre...",
              )}

              value={search}

              onChange={(e) => setSearch(e.target.value)}

              className="
bg-transparent
outline-none
text-white
w-full
"
            />
          </div>

          <div className="space-y-4">
            {filtered.map((member) => (
              <div
                key={member.id}

                className="
bg-white/5
rounded-xl
p-4
flex
justify-between
"
              >
                <div>
                  <h2
                    className="
text-white
font-bold
text-lg
"
                  >
                    {member.name}
                  </h2>

                  <p
                    className="
text-purple-400
"
                  >
                    🎮 {member.nickname}
                  </p>

                  <p
                    className="
text-gray-400
"
                  >
                    {member.phone}
                  </p>

                  <div
                    className="
flex
gap-5
mt-3
text-sm
"
                  >
                    <span
                      className="
text-green-400
"
                    >
                      Balance:
                      {member.balance} DA
                    </span>

                    <span
                      className="
text-red-400
"
                    >
                      Debt:
                      {member.debt} DA
                    </span>

                    <span
                      className="
text-blue-400
"
                    >
                      Hours:
                      {member.hours}
                    </span>
                  </div>
                </div>

                <div
                  className="
flex
items-center
gap-3
"
                >
                  <Wallet className="text-yellow-400" />

                  <button
                    onClick={() => deleteMember(member.id)}

                    className="
text-red-400
"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
