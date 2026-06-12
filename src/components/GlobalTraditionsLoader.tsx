import React, { useState, useEffect } from 'react';

type LoaderType = 'KULA' | 'IMECE' | 'AYNI' | 'UBUNTU' | 'XENIA' | 'GOTONG_ROYONG' | 'HARAMBEE' | 'POTLACH' | 'SADAQAH' | 'YUI' | 'GADUGI' | 'SUSU';

interface GlobalTraditionsLoaderProps {
  showLearnMore?: boolean;
}

const traditionDetails: Record<LoaderType, { title: string; origin: string; description: string; spirit: string; reference: string }> = {
  KULA: {
    title: "Kula Exchange",
    origin: "Trobriand Islands, Papua New Guinea",
    description: "A complex and ancient ceremonial gift-exchange system practiced across a ring of islands in the Massim region of Papua New Guinea. Valued artifacts—red shell necklaces (soulava) and white shell armbands (mwali)—circulate perpetually in opposite directions: necklaces clockwise, armbands counter-clockwise. These items are strictly non-commercial, hold no practical utility, and cannot be bought or sold; their value is built entirely on their historical pedigree, their unique name, and the oral histories of the prestigious partners who have previously possessed and passed them through the exchange ring.",
    spirit: "Grounded in the concept of delayed reciprocity, Kula partners must never balance their transaction at any single moment. The exchange is designed so that a gift is returned only after a delay, ensuring that partners remain in a permanent, open-ended state of mutual obligation and trust. Keeping an item too long is seen as hoarding (kabwaku) and brings severe loss of prestige. Status is earned not by retaining wealth, but by serving as a generous, trusted conduit in its continuous movement, proving that social connectivity is the highest form of value.",
    reference: "Bronislaw Malinowski, 'Argonauts of the Western Pacific' (1922) / Marcel Mauss, 'The Gift: Forms and Functions of Exchange in Archaic Societies' (1925) / Nancy D. Munn, 'The Fame of Gawa: A Symbolic Study of Value Transformation in a Massim (Papua New Guinea) Society' (1986)"
  },
  IMECE: {
    title: "İmece",
    origin: "Anatolia, Turkey",
    description: "A traditional, centuries-old rural practice of collective, voluntary village labor in Anatolian communities. When a task is too large or urgent for a single household to accomplish—such as harvesting wheat fields, baking bread for a wedding, building a house roof, clearing winter snow, or building public infrastructure like schools, mosques, and water channels—the entire village pools their labor, tools, and resources to complete the task together.",
    spirit: "İmece operates as a moral obligation and mutual insurance network. No transactional logs are kept, no hours are recorded, and no money is exchanged. Refusing to participate in İmece without a valid reason is seen as a serious breach of social trust, leading to symbolic fines or social exclusion (toplumdan dışlanma). The system relies on the unwritten certainty that the community will collectively carry the burden of any member in their time of need, establishing a safety net built on social capital.",
    reference: "Paul Stirling, 'Turkish Village' (1965) / Behice Boran, 'Toplumsal Yapı Araştırmaları' (Social Structure Studies, 1945) / Mahmut Makal, 'A Village in Anatolia' (1954)"
  },
  AYNI: {
    title: "Ayni",
    origin: "Andean Mountains",
    description: "An ancient Quechua and Aymara philosophy of sacred reciprocity and cosmic balance practiced in the Andean highlands. Unlike Minka, which is collective labor for community projects, Ayni operates between individual households. When a family needs help with planting, harvesting, building a home, or a wedding, their neighbors join in, and the host family provides food, chicha (maize beer), and coca leaves to sustain the workers.",
    spirit: "Ayni is built on the profound realization that human relationships are sustained by unfinished reciprocal debt. Andean neighbors consciously avoid perfectly balancing their mutual obligations immediately, as a settled debt effectively terminates the social relationship. Remaining in a state of mutual 'debt' (deuda) is not a source of anxiety, but a sacred social bond that ensures families remain connected in an endless, generational cycle of mutual care and interdependence.",
    reference: "Catherine J. Allen, 'The Hold Life Has: Coca and Cultural Identity in an Andean Community' (1988) / John Victor Murra, 'The Economic Organization of the Inka State' (1980) / Giorgio Alberti and Enrique Mayer, 'Reciprocidad e intercambio en los Andes peruanos' (1974)"
  },
  UBUNTU: {
    title: "Ubuntu",
    origin: "Southern Africa",
    description: "A profound humanist philosophy from the Bantu-speaking peoples of Southern Africa, commonly translated as 'I am because we are' or 'humanity towards others.' It highlights the belief that individual identity and humanity are co-dependent and can only be fully realized through our relationships with others. In village life, this manifests as shared childcare, open-door hospitality, and the collective sharing of food and harvests.",
    spirit: "Under Ubuntu, individual suffering, hunger, or misfortune is viewed as a direct diminishment of the collective humanity of the entire group. Sharing resources, shelter, and food is not treated as optional, patronizing charity, but as a mandatory restoration of balance to the communal body. If one member of the community is in need, others contribute unconditionally to restore harmony, reflecting the belief that the community's well-being is the ultimate safeguard of the individual.",
    reference: "Desmond Tutu, 'No Future Without Forgiveness' (1999) / Michael Onyebuchi Eze, 'Intellectual History of Ubuntu' (2010) / Augustine Shutte, 'Ubuntu: An Ethic for a New South Africa' (2001) / John S. Mbiti, 'African Religions & Philosophy' (1969)"
  },
  XENIA: {
    title: "Xenia",
    origin: "Ancient Greece",
    description: "The ancient Greek code of guest-host friendship and unconditional hospitality. It dictates that a host must welcome, feed, clothe, and bathe any traveling stranger before ever asking for their name, origin, or purpose. Upon departure, the host presents the guest with a parting gift (xenion) to solidify a lifelong alliance, which was inherited by their descendants.",
    spirit: "Protected by Zeus Xenios (Zeus the Protector of Strangers), Xenia was a sacred moral duty designed to turn potential enemies into trusted allies in a highly fragmented Mediterranean. The parting guest-gift established a hereditary bond of hospitality, ensuring that descendants of both host and guest could always find safety, shelter, and diplomatic asylum in distant city-states, creating a regional web of mutual protection.",
    reference: "Homer, 'The Odyssey' (c. 8th Century BCE) / Gabriel Herman, 'Ritualised Friendship and the Greek City' (1987) / M.I. Finley, 'The World of Odysseus' (1954)"
  },
  GOTONG_ROYONG: {
    title: "Gotong Royong",
    origin: "Indonesia & Southeast Asia",
    description: "A foundational cultural concept of spontaneous collective action, mutual assistance, and shared community responsibility in Indonesia and Southeast Asia. It is divided into kerja bakti (communal labor for public works like clearing canals or building temples) and tolong-menolong (mutual aid between neighbors). Its most famous expression is angkat rumah, where an entire village physically lifts a neighbor's wooden house on bamboo poles, carrying it to a new location.",
    spirit: "Translating to 'the mutual carrying of heavy burdens,' it embodies the belief that heavy tasks become weightless when shared. It prioritizes community consensus (musyawarah) and cosmic harmony over personal gain, treating the community as a single body where the movement, shelter, or harvest of one household is the active moral concern of all.",
    reference: "Koentjaraningrat, 'Gotong Rojong: Some Social-Anthropological Concepts of Mutual Aid and Co-operation in Indonesia' (1961) / Clifford Geertz, 'The Religion of Java' (1960) / Selo Soemardjan, 'Social Change in Jogjakarta' (1962)"
  },
  HARAMBEE: {
    title: "Harambee",
    origin: "Kenya",
    description: "A national self-help and mutual-aid tradition in Kenya meaning 'let us pull together' in Swahili. It brings communities together to pool funds, labor, and resources to build public infrastructure (such as schools, medical clinics, and water wells) or to support individual families facing severe emergencies like medical bills or school tuition.",
    spirit: "Harambee is a collective response to community needs that operates independently of top-down state aid. Regardless of wealth, every member contributes what they can—whether it is a day of physical labor, food, or a small coin. It teaches that the power of bottom-up collective effort and shared responsibility is the ultimate foundation for social growth, bypassing formal administrative hurdles to deliver immediate progress.",
    reference: "Jomo Kenyatta, 'Harambee: The Prime Minister of Kenya's Speeches' (1964) / Philip M. Mbithi and Rasmus Rasmusson, 'Self-Help in Kenya: The Case of Harambee' (1977) / Martin J. D. Hill, 'The Harambee Movement in Kenya' (1991)"
  },
  POTLACH: {
    title: "Potlatch",
    origin: "Pacific Northwest Coast (Indigenous Peoples)",
    description: "A complex ceremonial gift-giving festival and governance system practiced by Indigenous peoples of the Pacific Northwest Coast (such as the Kwakwaka'wakw, Haida, and Tlingit). A host chief invites neighboring clans for a grand feast to mark major life milestones (births, deaths, marriages), during which they distribute their family's wealth—including carved canoes, blankets, copper shields, and food.",
    spirit: "Potlatch operates on the principle that social status, authority, and prestige are measured not by what you accumulate, but by what you give away. It serves as an economic leveling mechanism, redistributing resources to prevent extreme inequality while building networks of mutual alliances and security across different clans, with guests obligated to return equal or greater gifts in subsequent feasts.",
    reference: "Marcel Mauss, 'The Gift' (1925) / Franz Boas, 'The Social Organization and the Secret Societies of the Kwakiutl Indians' (1897) / Helen Codere, 'Fighting with Property: A Study of Kwakiutl Potlatching and Warfare 1792-1930' (1950)"
  },
  SADAQAH: {
    title: "Sadaqah & Sabīl",
    origin: "Middle East & Islamic Tradition",
    description: "An Islamic tradition of voluntary charity and everyday kindness. In many arid and semi-arid towns and villages, this manifests physically as a Sabīl—placing public clay amphoras filled with cool, fresh water outside homes, or constructing ornate public fountains so that any passing traveler, stranger, or animal can quench their thirst, completely anonymously and free of charge.",
    spirit: "Sadaqah teaches that charity is not merely financial, but extends to any small act of goodwill. The Sabīl represents unconditional hospitality and community care, refreshing travelers without asking for their identity, belief, or payment. It is a form of giving (Sadaqah Jariyah) designed to preserve the absolute dignity of the receiver by removing any expectation of return.",
    reference: "Quran (Surah Al-Baqarah 2:261-274) / Marshall G.S. Hodgson, 'The Venture of Islam: Conscience and History in a World Civilization' (1974) / Amy Singer, 'Charity in Islamic Societies' (2008)"
  },
  YUI: {
    title: "Yui",
    origin: "Rural Japan",
    description: "A traditional, reciprocal mutual-aid system in mountain villages of Japan. Most famously, it is used to re-thatch the massive, steep reed roofs (gassho-zukuri or 'hands-in-prayer' style) of historic homes. Because the thatch must be replaced in a single day before it rains, hundreds of villagers pool their labor to complete the entire roof together.",
    spirit: "Re-thatching is too massive a task for a single family, making cooperative labor a matter of collective physical survival. Yui is a strictly reciprocal, household-to-household labor bond. Each family keeps track of their participation; if a household fails to help in Yui, they forfeit their own right to receive collective labor in the future, proving that mutual dependence is the ultimate survival mechanism in isolated environments.",
    reference: "Robert J. Smith, 'Kurusu: The Price of Progress in a Japanese Village' (1978) / John F. Embree, 'Suye Mura: A Japanese Village' (1939) / UNESCO World Heritage Centre, 'Advisory Body Evaluation: Historic Villages of Shirakawa-go and Gokayama' (1995)"
  },
  GADUGI: {
    title: "Gadugi",
    origin: "Cherokee Nation",
    description: "A traditional Cherokee philosophy and practice of working together for the common good. Historically, communities formed cooperative labor groups ('Gadugi companies') with elected officers that gathered to harvest crops, clear agricultural fields, maintain public spaces, and rebuild cabins for the elderly, widows, or the sick.",
    spirit: "Meaning 'people who are joined together' or 'working together,' Gadugi celebrates active community solidarity and sovereignty. Historically, Gadugi groups could be hired out for external projects, but all wages earned were deposited into a common treasury to help the vulnerable and pay community taxes, establishing a self-organized social safety net that preserved Cherokee autonomy.",
    reference: "James Mooney, 'Myths of the Cherokee' (1900) / Raymond D. Fogelson and Paul Kutsche, 'Cherokee Economic Cooperatives and the Gadugi' (1961) / Sharlotte Neely, 'Snowbird Cherokees: People of Persistence' (1991)"
  },
  SUSU: {
    title: "Susu",
    origin: "West Africa & The Caribbean",
    description: "A trust-based rotating savings and credit association (ROSCA) originating as Esusu among the Yoruba of West Africa and practiced widely across West Africa, the Caribbean, and global diaspora communities. Members contribute a fixed sum weekly or monthly, and at the end of each cycle, one member receives the entire lump sum in rotation to fund their goals.",
    spirit: "Operating entirely on peer accountability and social trust (amana) without banks, legal contracts, or interest, Susu allows members to raise capital through pure social capital. If a member faces a sudden crisis, the circle adapts to pay them early, transforming financial savings into a collective safety net that bypasses formal systems of economic marginalization.",
    reference: "William R. Bascom, 'The Esusu: A Rotating Credit Association of the Yoruba' (1952) / Shirley Ardener and Sandra Burman, 'Money-Go-Rounds: The Importance of Rotating Savings and Credit Associations for Women' (1995) / Clifford Geertz, 'The Rotating Credit Association: A 'Middle Rung' in Development' (1962)"
  }
};

export function GlobalTraditionsLoader({ showLearnMore = false }: GlobalTraditionsLoaderProps) {
  const [loaderType, setLoaderType] = useState<LoaderType>('KULA');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loaderProfiles = {
    KULA: {
      messages: [
        "Kula: Sailing between islands in the ceremonial ring...",
        "Kula: Exchanging red shell necklaces clockwise...",
        "Kula: Exchanging white shell armbands counter-clockwise...",
        "Kula: Weaving trust through lifelong partnerships...",
        "Kula: Loading canoes with sacred gifts..."
      ],
      color: "#5B6B56" // Sage green
    },
    IMECE: {
      messages: [
        "İmece: Sharing collective, voluntary labor for the village...",
        "İmece: Joining together to harvest crops...",
        "İmece: Baking bread and cooking wedding feasts...",
        "İmece: Building roofs and clearing winter roads...",
        "İmece: Uniting to carry each other's burdens..."
      ],
      color: "#C87A53" // Terracotta
    },
    AYNI: {
      messages: [
        "Ayni: Living in sacred reciprocity and cosmic balance...",
        "Ayni: Working turn-by-turn on terraced fields...",
        "Ayni: Building homes for neighbors in need...",
        "Ayni: Exchanging harvest labor and chicha...",
        "Ayni: Sustaining relationships through reciprocal debt..."
      ],
      color: "#D9A05B" // Ochre/Mustard yellow
    },
    UBUNTU: {
      messages: [
        "Ubuntu: Believing that a person is a person through others...",
        "Ubuntu: Sharing warmth and conversation around the fire...",
        "Ubuntu: Restoring harmony to the communal body...",
        "Ubuntu: Ensuring no member goes hungry or alone...",
        "Ubuntu: Valuing community connection over accumulation..."
      ],
      color: "#8C7D8F" // Muted Purple
    },
    XENIA: {
      messages: [
        "Xenia: Welcoming travelers with unconditional hospitality...",
        "Xenia: Bathing and feeding guests before asking their name...",
        "Xenia: Honoring the guest-host alliance under Zeus...",
        "Xenia: Presenting guest-gifts to seal lifelong bonds...",
        "Xenia: Offering safe shelter across distant horizons..."
      ],
      color: "#A37E58" // Warm Greek clay/bronze
    },
    GOTONG_ROYONG: {
      messages: [
        "Gotong Royong: Carrying community burdens together...",
        "Gotong Royong: Lifting a neighbor's house on bamboo poles...",
        "Gotong Royong: Clearing canals and farming fields collectively...",
        "Gotong Royong: Reaching consensus for village harmony...",
        "Gotong Royong: Mobilizing spontaneous aid for the commons..."
      ],
      color: "#3F6D66" // Deep tropical emerald/teal
    },
    HARAMBEE: {
      messages: [
        "Harambee: Pulling together to build local schools...",
        "Harambee: Pooling community funds for medical emergencies...",
        "Harambee: Contributing labor and resources relative to means...",
        "Harambee: Constructing village water wells collectively...",
        "Harambee: Organizing bottom-up community action..."
      ],
      color: "#9C4F3C" // Earthy Kenyan terracotta/ochre-red
    },
    POTLACH: {
      messages: [
        "Potlatch: Distributing family wealth to guest clans...",
        "Potlatch: Gifting copper shields and wool blankets at feasts...",
        "Potlatch: Measuring prestige by giving, not keeping...",
        "Potlatch: Redistributing resources to balance the community...",
        "Potlatch: Forging alliances across coastal villages..."
      ],
      color: "#B35C37" // Warm cedar-red/copper
    },
    SADAQAH: {
      messages: [
        "Sadaqah: Offering anonymous charity and everyday kindness...",
        "Sadaqah: Placing cool water jars outside for travelers...",
        "Sadaqah: Refreshing thirsty animals and strangers...",
        "Sadaqah: Giving freely to protect the receiver's dignity...",
        "Sadaqah: Flowing like water in quiet goodwill..."
      ],
      color: "#C59B73" // Warm desert clay/sand
    },
    YUI: {
      messages: [
        "Yui: Re-thatching steep cottage roofs in a single day...",
        "Yui: Passing bundles of golden reed hand-to-hand...",
        "Yui: Binding straw together in mountain villages...",
        "Yui: Committing reciprocal household labor to neighbors...",
        "Yui: Cooperating on shelter for collective survival..."
      ],
      color: "#AF8A3C" // Muted gold/thatch
    },
    GADUGI: {
      messages: [
        "Gadugi: Harvesting agricultural fields collectively...",
        "Gadugi: Clearing land and building cabins for the needy...",
        "Gadugi: Depositing wages into a common treasury...",
        "Gadugi: Pulling together in active solidarity...",
        "Gadugi: Organizing town labor for the public good..."
      ],
      color: "#4E7C59" // Soft forest green
    },
    SUSU: {
      messages: [
        "Susu: Pooling savings in rotating credit circles...",
        "Susu: Exchanging the fund cycle-by-cycle on pure trust...",
        "Susu: Creating capital without banks or interest rates...",
        "Susu: Supporting members in sudden family emergencies...",
        "Susu: Cultivating wealth through peer accountability..."
      ],
      color: "#4F688B" // Deep indigo/slate blue
    }
  };

  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    // Select a random tradition on mount
    const types: LoaderType[] = ['KULA', 'IMECE', 'AYNI', 'UBUNTU', 'XENIA', 'GOTONG_ROYONG', 'HARAMBEE', 'POTLACH', 'SADAQAH', 'YUI', 'GADUGI', 'SUSU'];
    const randomType = types[Math.floor(Math.random() * types.length)];
    setLoaderType(randomType);
  }, []);

  useEffect(() => {
    const profile = loaderProfiles[loaderType];
    const timer = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % profile.messages.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [loaderType]);

  const activeProfile = loaderProfiles[loaderType];

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <style>{`
        /* --- General Animations --- */
        @keyframes kula-pulse-organic {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        @keyframes kula-fade-in-out {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out forwards;
        }

        /* --- KULA ANIMATIONS --- */
        @keyframes kula-rotate-clockwise {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes kula-rotate-counter-clockwise {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        .kula-boat-1 {
          animation: kula-rotate-clockwise 14s linear infinite;
          transform-origin: 100px 100px;
        }
        .kula-boat-2 {
          animation: kula-rotate-counter-clockwise 20s linear infinite;
          transform-origin: 100px 100px;
        }

        /* --- İMECE ANIMATIONS --- */
        @keyframes imece-tile-slide {
          0% { transform: translate(0px, 0px); opacity: 0; }
          10% { opacity: 1; }
          40% { transform: translate(15px, -35px); }
          80% { transform: translate(30px, -70px); }
          90% { opacity: 1; }
          100% { transform: translate(35px, -75px); opacity: 0; }
        }
        @keyframes imece-flame-burn {
          0%, 100% { transform: scaleY(1) scaleX(1); }
          50% { transform: scaleY(1.3) scaleX(0.85); }
        }
        @keyframes imece-steam-rise {
          0% { transform: translateY(0) scale(0.8); opacity: 0; }
          20% { opacity: 0.6; }
          100% { transform: translateY(-25px) scale(1.3); opacity: 0; }
        }
        .imece-tile {
          animation: imece-tile-slide 3.5s linear infinite;
          transform-origin: bottom left;
        }
        .imece-flame {
          animation: imece-flame-burn 0.8s ease-in-out infinite;
          transform-origin: 65px 150px;
        }
        .imece-steam {
          animation: imece-steam-rise 3s ease-out infinite;
          transform-origin: center;
        }

        /* --- AYNI ANIMATIONS --- */
        @keyframes ayni-llama-walk {
          0% { transform: translate(52px, 120px) scaleX(1); }
          45% { transform: translate(137px, 120px) scaleX(1); }
          50% { transform: translate(137px, 120px) scaleX(-1); }
          95% { transform: translate(52px, 120px) scaleX(-1); }
          100% { transform: translate(52px, 120px) scaleX(1); }
        }
        @keyframes ayni-llama-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2.5px); }
        }
        @keyframes ayni-gift-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-5px) rotate(6deg); }
        }
        .ayni-llama-group {
          animation: ayni-llama-walk 12s linear infinite;
        }
        .ayni-llama-body {
          animation: ayni-llama-bounce 0.6s ease-in-out infinite;
        }
        .ayni-gift {
          animation: ayni-gift-float 4s ease-in-out infinite;
          transform-origin: 100px 105px;
        }

        /* --- UBUNTU ANIMATIONS --- */
        @keyframes ubuntu-ember-float {
          0% { transform: translate(0, 0) scale(0.6); opacity: 0; }
          20% { opacity: 0.8; }
          100% { transform: translate(var(--dx), -45px) scale(0.2); opacity: 0; }
        }
        @keyframes ubuntu-fire-glow {
          0%, 100% { transform: scale(1); opacity: 0.2; }
          50% { transform: scale(1.15); opacity: 0.4; }
        }
        .ubuntu-ember {
          animation: ubuntu-ember-float 3.5s ease-out infinite;
        }
        .ubuntu-fire-glow {
          animation: ubuntu-fire-glow 2.5s ease-in-out infinite;
          transform-origin: 100px 135px;
        }
        .ubuntu-star {
          animation: kula-fade-in-out 3s ease-in-out infinite;
        }

        /* --- XENIA ANIMATIONS --- */
        @keyframes xenia-fire-glow {
          0%, 100% { transform: scale(1); opacity: 0.2; }
          50% { transform: scale(1.2); opacity: 0.45; }
        }
        .xenia-hearth-glow {
          animation: xenia-fire-glow 2s ease-in-out infinite;
          transform-origin: 100px 120px;
        }
        .xenia-flame {
          animation: imece-flame-burn 0.9s ease-in-out infinite;
          transform-origin: 100px 128px;
        }
        .xenia-star {
          animation: kula-pulse-organic 4s ease-in-out infinite;
          transform-origin: 100px 25px;
        }

        /* --- GOTONG ROYONG ANIMATIONS --- */
        @keyframes gotong-house-sway {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-3px) rotate(1deg); }
        }
        .gotong-house-sway {
          animation: gotong-house-sway 3.2s ease-in-out infinite;
          transform-origin: 100px 140px;
        }

        /* --- HARAMBEE ANIMATIONS --- */
        @keyframes harambee-helper-left-sway {
          0%, 100% { transform: translate(68px, 150px) rotate(0deg); }
          50% { transform: translate(68px, 150px) rotate(-3deg); }
        }
        @keyframes harambee-helper-right-sway {
          0%, 100% { transform: translate(132px, 150px) rotate(0deg); }
          50% { transform: translate(132px, 150px) rotate(3deg); }
        }
        .harambee-helper-left {
          animation: harambee-helper-left-sway 4s ease-in-out infinite;
          transform-origin: bottom center;
        }
        .harambee-helper-right {
          animation: harambee-helper-right-sway 4s ease-in-out infinite;
          transform-origin: bottom center;
        }
         .harambee-sparkle {
          animation: kula-pulse-organic 2.5s ease-in-out infinite;
          transform-origin: 100px 100px;
        }

        /* --- POTLACH ANIMATIONS --- */
        @keyframes potlach-copper-float {
          0%, 100% { transform: translate(100px, 105px) translateY(0); }
          50% { transform: translate(100px, 105px) translateY(-4px); }
        }
        .potlach-copper {
          animation: potlach-copper-float 3.5s ease-in-out infinite;
        }
        .potlach-flame {
          animation: imece-flame-burn 0.8s ease-in-out infinite;
          transform-origin: 100px 146px;
        }

        /* --- SADAQAH ANIMATIONS --- */
        @keyframes sadaqah-drip {
          0% { transform: translateY(0) scaleY(1); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(68px) scaleY(1.2); opacity: 0; }
        }
        .sadaqah-drop-1 {
          animation: sadaqah-drip 2s linear infinite;
          transform-origin: center;
        }
        .sadaqah-drop-2 {
          animation: sadaqah-drip 2s linear infinite;
          animation-delay: 1s;
          transform-origin: center;
        }

        /* --- YUI ANIMATIONS --- */
        @keyframes yui-thatch-pass {
          0% { transform: translate(65px, 140px) scale(0.6); opacity: 0; }
          10% { opacity: 1; }
          80% { transform: translate(110px, 70px) scale(0.9); opacity: 1; }
          95% { opacity: 0; }
          100% { transform: translate(110px, 70px) scale(0.9); opacity: 0; }
        }
        .yui-thatch {
          animation: yui-thatch-pass 3s ease-in-out infinite;
        }

        /* --- GADUGI ANIMATIONS --- */
        @keyframes gadugi-corn-sway {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(3deg); }
        }
        @keyframes gadugi-basket-shimmer {
          0%, 100% { filter: drop-shadow(0 0 1px rgba(217, 160, 91, 0.4)); }
          50% { filter: drop-shadow(0 0 6px rgba(217, 160, 91, 0.9)); }
        }
        .gadugi-corn-1 {
          animation: gadugi-corn-sway 3s ease-in-out infinite;
          transform-origin: 0px 0px;
        }
        .gadugi-corn-2 {
          animation: gadugi-corn-sway 2.5s ease-in-out infinite;
          transform-origin: 0px 0px;
        }
        .gadugi-basket {
          animation: gadugi-basket-shimmer 2s ease-in-out infinite;
        }
        @keyframes gadugi-helper-reach {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-3deg); }
        }
        .gadugi-helper {
          animation: gadugi-helper-reach 3.5s ease-in-out infinite;
          transform-origin: 0px 0px;
        }

        /* --- SUSU ANIMATIONS --- */
        @keyframes susu-coin-orbit-1 {
          from { transform: rotate(0deg) translate(50px) rotate(0deg); }
          to { transform: rotate(360deg) translate(50px) rotate(-360deg); }
        }
        @keyframes susu-coin-orbit-2 {
          from { transform: rotate(120deg) translate(50px) rotate(-120deg); }
          to { transform: rotate(480deg) translate(50px) rotate(-480deg); }
        }
        @keyframes susu-coin-orbit-3 {
          from { transform: rotate(240deg) translate(50px) rotate(-240deg); }
          to { transform: rotate(600deg) translate(50px) rotate(-600deg); }
        }
        .susu-coin-1 {
          animation: susu-coin-orbit-1 6s linear infinite;
          transform-origin: 100px 105px;
        }
        .susu-coin-2 {
          animation: susu-coin-orbit-2 6s linear infinite;
          transform-origin: 100px 105px;
        }
        .susu-coin-3 {
          animation: susu-coin-orbit-3 6s linear infinite;
          transform-origin: 100px 105px;
        }
      `}</style>

      <div className="relative w-64 h-64 bg-[#FAF7F0] rounded-full border-4 border-[#EADFC9]/30 shadow-inner flex items-center justify-center overflow-hidden">
        
        {/* ============================================================== */}
        {/* 1. POLYNESIAN KULA RING LOADER */}
        {/* ============================================================== */}
        {loaderType === 'KULA' && (
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {/* Wave ripples */}
            <path d="M20,100 C40,95 60,105 80,100 C100,95 120,105 140,100 C160,95 180,105 200,100" fill="none" stroke="#E6E0D2" strokeWidth="2" strokeDasharray="4 6" />
            <path d="M10,50 C30,45 50,55 70,50 C90,45 110,55 130,50 C150,45 170,55 190,50" fill="none" stroke="#E6E0D2" strokeWidth="1.5" strokeDasharray="3 5" />
            <path d="M30,150 C50,145 70,155 90,150 C110,145 130,155 150,150 C170,145 190,155 210,150" fill="none" stroke="#E6E0D2" strokeWidth="1.5" strokeDasharray="3 5" />
            <circle cx="100" cy="100" r="30" fill="none" stroke="#EADFC9" strokeWidth="1" strokeDasharray="2 4" />
            <circle cx="100" cy="100" r="60" fill="none" stroke="#EADFC9" strokeWidth="1" strokeDasharray="3 5" />
            
            {/* Island 1: North (Sage green, round organic) */}
            <g className="kula-island" style={{ transformOrigin: '100px 40px', animation: 'kula-pulse-organic 6s ease-in-out infinite' }}>
              <path d="M80,35 C85,25 115,25 120,35 C125,45 115,55 100,55 C85,55 75,45 80,35 Z" fill="#E8D8B8" opacity="0.8" />
              <path d="M85,35 C90,28 110,28 115,35 C118,41 110,48 100,48 C90,48 82,41 85,35 Z" fill="#5B6B56" />
              <path d="M100,32 Q97,22 93,20" fill="none" stroke="#4E3629" strokeWidth="1.5" />
              <path d="M93,20 C91,18 87,19 86,21 C85,23 88,24 93,20 Z" fill="#7C8A75" />
              <path d="M93,20 C94,17 98,16 99,18 C100,20 97,21 93,20 Z" fill="#7C8A75" />
            </g>

            {/* Island 2: East (Ochre/Mustard, double peak) */}
            <g className="kula-island" style={{ transformOrigin: '165px 100px', animation: 'kula-pulse-organic 6s ease-in-out infinite', animationDelay: '1.5s' }}>
              <path d="M150,90 C165,80 180,90 185,100 C190,110 175,120 160,118 C145,115 140,100 150,90 Z" fill="#EADFC9" opacity="0.8" />
              <path d="M154,94 C164,86 174,94 178,100 C180,106 170,112 160,110 C150,108 148,100 154,94 Z" fill="#C87A53" />
              <line x1="160" y1="98" x2="164" y2="102" stroke="#FAF7F0" strokeWidth="1" />
              <line x1="166" y1="96" x2="170" y2="100" stroke="#FAF7F0" strokeWidth="1" />
            </g>

            {/* Island 3: South (Terracotta/Red-Brown, wide) */}
            <g className="kula-island" style={{ transformOrigin: '100px 160px', animation: 'kula-pulse-organic 6s ease-in-out infinite', animationDelay: '3s' }}>
              <path d="M85,160 C75,145 125,145 115,160 C105,170 95,170 85,160 Z" fill="#E8D8B8" opacity="0.8" />
              <path d="M90,157 C83,148 117,148 110,157 C103,163 97,163 90,157 Z" fill="#D9A05B" />
            </g>

            {/* Island 4: West (Teal/Emerald green, tall peak) */}
            <g className="kula-island" style={{ transformOrigin: '35px 100px', animation: 'kula-pulse-organic 6s ease-in-out infinite', animationDelay: '4.5s' }}>
              <path d="M20,100 C25,85 45,85 50,100 C55,115 45,120 35,118 C25,115 15,110 20,100 Z" fill="#EADFC9" opacity="0.8" />
              <path d="M25,100 C28,90 42,90 45,100 C48,110 40,114 35,112 C30,110 22,108 25,100 Z" fill="#5A7052" />
            </g>

            {/* Boat 1: Sailing Clockwise at radius ~65 */}
            <g className="kula-boat-1">
              <g transform="translate(100, 35)">
                <path d="M-10,2 C-5,5 5,5 10,2 C7,0 -7,0 -10,2 Z" fill="#4E3629" />
                <path d="M-8,-4 C-4,-3 4,-3 8,-4" fill="none" stroke="#4E3629" strokeWidth="1" />
                <line x1="-5" y1="1" x2="-5" y2="-3.5" stroke="#4E3629" strokeWidth="0.8" />
                <line x1="5" y1="1" x2="5" y2="-3.5" stroke="#4E3629" strokeWidth="0.8" />
                <path d="M0,0 L-5,-12 L5,-10 Z" fill="#FAF7F0" stroke="#C87A53" strokeWidth="1" />
                <rect x="-2" y="1" width="4" height="3" fill="#D9A05B" rx="0.5" />
              </g>
            </g>

            {/* Boat 2: Sailing Counter-Clockwise (representing white armbands going the other way) */}
            <g className="kula-boat-2">
              <g transform="translate(100, 165) rotate(0)">
                <path d="M-10,2 C-5,5 5,5 10,2 C7,0 -7,0 -10,2 Z" fill="#4E3629" />
                <path d="M-8,-4 C-4,-3 4,-3 8,-4" fill="none" stroke="#4E3629" strokeWidth="1" />
                <line x1="-5" y1="1" x2="-5" y2="-3.5" stroke="#4E3629" strokeWidth="0.8" />
                <line x1="5" y1="1" x2="5" y2="-3.5" stroke="#4E3629" strokeWidth="0.8" />
                <path d="M0,0 L-4,-14 L4,-12 Z" fill="#FAF7F0" stroke="#5B6B56" strokeWidth="1" />
                <circle cx="0" cy="2" r="2.2" fill="#C87A53" />
              </g>
            </g>
          </svg>
        )}

        {/* ============================================================== */}
        {/* 2. TURKISH İMECE LOADER */}
        {/* ============================================================== */}
        {loaderType === 'IMECE' && (
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {/* Background sunset & hills */}
            <path d="M 0,160 Q 50,140 100,150 T 200,155 L 200,200 L 0,200 Z" fill="#FAF5E8" />
            <path d="M 0,165 Q 60,155 120,162 T 200,165 L 200,200 L 0,200 Z" fill="#EADFC9" opacity="0.3" />
            
            {/* The Cottage */}
            {/* Main Stone Wall */}
            <rect x="110" y="90" width="65" height="65" fill="#FAF7F0" stroke="#4E3629" strokeWidth="2.5" rx="3" />
            {/* Door */}
            <rect x="130" y="115" width="16" height="40" fill="#C87A53" stroke="#4E3629" strokeWidth="2" rx="1" />
            <circle cx="142" cy="135" r="1.5" fill="#FAF7F0" />
            {/* Window */}
            <rect x="154" y="102" width="14" height="14" fill="#E8D8B8" stroke="#4E3629" strokeWidth="1.8" rx="1" />
            <line x1="161" y1="102" x2="161" y2="116" stroke="#4E3629" strokeWidth="1.2" />
            <line x1="154" y1="109" x2="168" y2="109" stroke="#4E3629" strokeWidth="1.2" />
            
            {/* Base Roof Outline */}
            <path d="M102,90 L142.5,50 L183,90 Z" fill="#E8D8B8" stroke="#4E3629" strokeWidth="2.5" />
            
            {/* Terracotta tiled roof details */}
            <path d="M108,86 Q142.5,53 177,86" fill="none" stroke="#C87A53" strokeWidth="4" strokeDasharray="6 3" />
            <path d="M115,80 Q142.5,57 170,80" fill="none" stroke="#C87A53" strokeWidth="4" strokeDasharray="6 3" />
            
            {/* The Ladder */}
            <line x1="105" y1="155" x2="140" y2="78" stroke="#4E3629" strokeWidth="3" />
            <line x1="113" y1="155" x2="148" y2="78" stroke="#4E3629" strokeWidth="3" />
            {/* Ladder Rungs */}
            <line x1="107" y1="145" x2="115" y2="145" stroke="#4E3629" strokeWidth="2" />
            <line x1="111" y1="133" x2="119" y2="133" stroke="#4E3629" strokeWidth="2" />
            <line x1="116" y1="121" x2="124" y2="121" stroke="#4E3629" strokeWidth="2" />
            <line x1="121" y1="109" x2="129" y2="109" stroke="#4E3629" strokeWidth="2" />
            <line x1="126" y1="97" x2="134" y2="97" stroke="#4E3629" strokeWidth="2" />
            <line x1="131" y1="85" x2="139" y2="85" stroke="#4E3629" strokeWidth="2" />
            
            {/* Stirring Cauldron Scene */}
            {/* Campfire logs */}
            <line x1="45" y1="152" x2="65" y2="145" stroke="#4E3629" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="65" y1="152" x2="45" y2="145" stroke="#4E3629" strokeWidth="3.5" strokeLinecap="round" />
            {/* Bubbling fire flame */}
            <path className="imece-flame" d="M51,148 Q55,130 55,136 Q55,122 60,132 Q65,124 64,136 Q64,130 68,148 Z" fill="#D9A05B" />
            <path className="imece-flame" style={{ animationDelay: '0.4s' }} d="M54,148 Q56,134 57,138 Q58,128 61,135 Q63,130 63,138 Q63,134 66,148 Z" fill="#C87A53" />
            
            {/* The Copper Cauldron */}
            <path d="M42,125 C42,143 78,143 78,125 C78,118 42,118 42,125 Z" fill="#A06048" stroke="#4E3629" strokeWidth="2" />
            <path d="M38,118 L82,118" stroke="#4E3629" strokeWidth="3" strokeLinecap="round" />
            <path d="M45,118 Q45,110 50,111" fill="none" stroke="#4E3629" strokeWidth="1.5" />
            <path d="M75,118 Q75,110 70,111" fill="none" stroke="#4E3629" strokeWidth="1.5" />
            
            {/* Steam animation puffs */}
            <path className="imece-steam" style={{ animationDelay: '0s' }} d="M48,112 A 4,4 0 0,1 56,112" fill="none" stroke="#FAF7F0" strokeWidth="1.5" strokeLinecap="round" />
            <path className="imece-steam" style={{ animationDelay: '1.2s' }} d="M60,110 A 3.5,3.5 0 0,1 67,110" fill="none" stroke="#FAF7F0" strokeWidth="1.5" strokeLinecap="round" />
            <path className="imece-steam" style={{ animationDelay: '2s' }} d="M54,113 A 4.5,4.5 0 0,1 63,113" fill="none" stroke="#FAF7F0" strokeWidth="1.5" strokeLinecap="round" />

            {/* Sliding Roof Tile (cooperative building animation) */}
            <g className="imece-tile">
              <rect x="105" y="146" width="7" height="4" rx="1.2" fill="#C87A53" stroke="#4E3629" strokeWidth="1" />
            </g>
          </svg>
        )}

        {/* ============================================================== */}
        {/* 3. ANDEAN AYNI LOADER */}
        {/* ============================================================== */}
        {loaderType === 'AYNI' && (
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {/* Terraced mountain backdrops */}
            <path d="M-10,130 L40,80 L90,120 L150,70 L210,120 L210,200 L-10,200 Z" fill="#5A7052" stroke="#4E3629" strokeWidth="2.5" />
            {/* Terraced ridges */}
            <path d="M-10,145 Q40,120 90,140 T210,135" fill="none" stroke="#FAF7F0" strokeWidth="2" strokeDasharray="3 4" />
            <path d="M-10,165 Q45,145 95,160 T210,158" fill="none" stroke="#FAF7F0" strokeWidth="2" strokeDasharray="3 4" />
            
            {/* Sun in the sky */}
            <circle cx="100" cy="50" r="16" fill="#D9A05B" stroke="#4E3629" strokeWidth="2" />
            {/* Sun rays */}
            <line x1="100" y1="26" x2="100" y2="30" stroke="#4E3629" strokeWidth="2" strokeLinecap="round" />
            <line x1="100" y1="70" x2="100" y2="74" stroke="#4E3629" strokeWidth="2" strokeLinecap="round" />
            <line x1="76" y1="50" x2="80" y2="50" stroke="#4E3629" strokeWidth="2" strokeLinecap="round" />
            <line x1="120" y1="50" x2="124" y2="50" stroke="#4E3629" strokeWidth="2" strokeLinecap="round" />
            <line x1="83" y1="33" x2="86" y2="36" stroke="#4E3629" strokeWidth="2" strokeLinecap="round" />
            <line x1="117" y1="67" x2="114" y2="64" stroke="#4E3629" strokeWidth="2" strokeLinecap="round" />
            <line x1="83" y1="67" x2="86" y2="64" stroke="#4E3629" strokeWidth="2" strokeLinecap="round" />
            <line x1="117" y1="33" x2="114" y2="36" stroke="#4E3629" strokeWidth="2" strokeLinecap="round" />

            {/* Left Cottage */}
            <rect x="25" y="110" width="28" height="26" fill="#C87A53" stroke="#4E3629" strokeWidth="2" rx="2" />
            <polygon points="20,112 39,94 58,112" fill="#FAF7F0" stroke="#4E3629" strokeWidth="2" />
            <rect x="35" y="122" width="8" height="14" fill="#4E3629" />

            {/* Right Cottage */}
            <rect x="147" y="110" width="28" height="26" fill="#C87A53" stroke="#4E3629" strokeWidth="2" rx="2" />
            <polygon points="142,112 161,94 180,112" fill="#FAF7F0" stroke="#4E3629" strokeWidth="2" />
            <rect x="157" y="122" width="8" height="14" fill="#4E3629" />

            {/* The reciprocal floating harvest gift in the center */}
            <g className="ayni-gift">
              {/* Basket */}
              <path d="M92,105 C92,114 108,114 108,105 Z" fill="#E8D8B8" stroke="#4E3629" strokeWidth="1.5" />
              {/* Golden maize peaks inside */}
              <circle cx="96" cy="103" r="3" fill="#D9A05B" stroke="#4E3629" strokeWidth="0.8" />
              <circle cx="104" cy="103" r="3" fill="#D9A05B" stroke="#4E3629" strokeWidth="0.8" />
              <circle cx="100" cy="101" r="3.2" fill="#D9A05B" stroke="#4E3629" strokeWidth="0.8" />
              {/* Sparkle star */}
              <path d="M100,90 L101.5,93.5 L105,94 L102,96.5 L103,100 L100,98 L97,100 L98,96.5 L95,94 L98.5,93.5 Z" fill="#FAF7F0" stroke="#D9A05B" strokeWidth="0.5" />
            </g>

            {/* Walking Llama (Ayni exchange traveler) */}
            <g className="ayni-llama-group" transform="translate(52, 120)">
              <g className="ayni-llama-body">
                {/* Llama drawing */}
                {/* Legs */}
                <line x1="-3" y1="8" x2="-3" y2="16" stroke="#4E3629" strokeWidth="2" strokeLinecap="round" />
                <line x1="3" y1="8" x2="3" y2="16" stroke="#4E3629" strokeWidth="2" strokeLinecap="round" />
                <line x1="-7" y1="8" x2="-7" y2="15" stroke="#4E3629" strokeWidth="2" strokeLinecap="round" />
                <line x1="7" y1="8" x2="7" y2="15" stroke="#4E3629" strokeWidth="2" strokeLinecap="round" />
                {/* Body */}
                <rect x="-9" y="-2" width="18" height="11" fill="#FAF7F0" stroke="#4E3629" strokeWidth="2" rx="3" />
                {/* Neck & Head */}
                <path d="M6,1 L9,-12 Q10,-15 13,-14 Q15,-13 13,-10" fill="none" stroke="#4E3629" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M6,1 L9,-12" fill="none" stroke="#FAF7F0" strokeWidth="2" />
                <circle cx="11" cy="-12" r="1.5" fill="#4E3629" />
                {/* Tail */}
                <path d="M-9,1 Q-13,-2 -11,-5" fill="none" stroke="#4E3629" strokeWidth="2" strokeLinecap="round" />
                {/* Woven gift blanket on its back */}
                <rect x="-5" y="-3.5" width="10" height="4" fill="#C87A53" stroke="#4E3629" strokeWidth="1" />
                <line x1="-2" y1="-3.5" x2="-2" y2="0" stroke="#FAF7F0" strokeWidth="0.8" />
                <line x1="2" y1="-3.5" x2="2" y2="0" stroke="#FAF7F0" strokeWidth="0.8" />
              </g>
            </g>
          </svg>
        )}

        {/* ============================================================== */}
        {/* 4. SOUTHERN AFRICAN UBUNTU LOADER */}
        {/* ============================================================== */}
        {loaderType === 'UBUNTU' && (
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {/* Sunset gradient backdrop background */}
            <rect x="0" y="0" width="200" height="200" fill="#FFFBF5" />
            <circle cx="100" cy="140" r="120" fill="#FAF0E0" opacity="0.4" />
            <circle cx="100" cy="140" r="85" fill="#F8E3C9" opacity="0.3" />
            
            {/* Blinking stars */}
            <circle className="ubuntu-star" style={{ animationDelay: '0s' }} cx="35" cy="40" r="1.2" fill="#FAF7F0" />
            <circle className="ubuntu-star" style={{ animationDelay: '1s' }} cx="165" cy="50" r="1" fill="#FAF7F0" />
            <circle className="ubuntu-star" style={{ animationDelay: '1.8s' }} cx="95" cy="25" r="1.5" fill="#FAF7F0" />
            <circle className="ubuntu-star" style={{ animationDelay: '0.5s' }} cx="130" cy="35" r="1" fill="#FAF7F0" />
            <circle className="ubuntu-star" style={{ animationDelay: '2.3s' }} cx="60" cy="55" r="1.2" fill="#FAF7F0" />

            {/* Tree branches & canopy silhouette (Acacia style) */}
            <path d="M25,120 Q30,95 24,80 Q24,75 35,77 Q45,80 50,95" fill="none" stroke="#4E3629" strokeWidth="4" strokeLinecap="round" />
            <path d="M12,78 Q28,68 45,74 Q60,78 72,75 Q85,72 90,60" fill="none" stroke="#4E3629" strokeWidth="2.5" strokeLinecap="round" />
            {/* Flat canopy leaves */}
            <ellipse cx="28" cy="74" rx="20" ry="5" fill="#5B6B56" stroke="#4E3629" strokeWidth="1.5" />
            <ellipse cx="50" cy="72" rx="16" ry="4" fill="#5B6B56" stroke="#4E3629" strokeWidth="1.5" />
            <ellipse cx="75" cy="70" rx="24" ry="5.5" fill="#5B6B56" stroke="#4E3629" strokeWidth="1.5" />
            <ellipse cx="14" cy="77" rx="12" ry="3.5" fill="#5B6B56" stroke="#4E3629" strokeWidth="1.5" />
            
            {/* Ground line */}
            <path d="M 0,165 Q 100,158 200,165 L 200,200 L 0,200 Z" fill="#EADFC9" opacity="0.6" />
            <line x1="0" y1="165" x2="200" y2="165" stroke="#4E3629" strokeWidth="2.5" />

            {/* Fire glow ring */}
            <circle className="ubuntu-fire-glow" cx="100" cy="138" r="22" fill="#D9A05B" opacity="0.3" />

            {/* Campfire logs */}
            <line x1="90" y1="145" x2="110" y2="138" stroke="#4E3629" strokeWidth="4.5" strokeLinecap="round" />
            <line x1="110" y1="145" x2="90" y2="138" stroke="#4E3629" strokeWidth="4.5" strokeLinecap="round" />
            <line x1="100" y1="147" x2="100" y2="135" stroke="#4E3629" strokeWidth="3" strokeLinecap="round" />
            
            {/* Glowing campfire flames */}
            <path className="imece-flame" d="M92,142 Q100,118 100,126 Q100,108 105,122 Q110,112 108,126 Q108,120 114,142 Z" fill="#C87A53" />
            <path className="imece-flame" style={{ animationDelay: '0.4s' }} d="M95,142 Q100,122 101,127 Q102,115 106,124 Q108,118 108,127 Q108,123 111,142 Z" fill="#D9A05B" />

            {/* Embers floating upwards */}
            <circle className="ubuntu-ember" style={{ '--dx': '15px', animationDelay: '0s' } as any} cx="102" cy="115" r="1.5" fill="#D9A05B" />
            <circle className="ubuntu-ember" style={{ '--dx': '-10px', animationDelay: '1.2s' } as any} cx="97" cy="118" r="1.2" fill="#C87A53" />
            <circle className="ubuntu-ember" style={{ '--dx': '5px', animationDelay: '2.2s' } as any} cx="104" cy="110" r="1" fill="#FAF7F0" />
            <circle className="ubuntu-ember" style={{ '--dx': '-20px', animationDelay: '0.7s' } as any} cx="98" cy="112" r="1.4" fill="#D9A05B" />
            <circle className="ubuntu-ember" style={{ '--dx': '12px', animationDelay: '1.9s' } as any} cx="106" cy="116" r="1.2" fill="#C87A53" />

            {/* Circular group of figures holding hands (representing Ubuntu) */}
            {/* Figure 1: Far Left */}
            <g transform="translate(45, 128)">
              <circle cx="0" cy="-6" r="3.5" fill="#FAF7F0" stroke="#4E3629" strokeWidth="1.8" />
              <path d="M-4,10 L-4,0 Q0,-1 4,0 L4,10" fill="#FAF7F0" stroke="#4E3629" strokeWidth="1.8" />
            </g>
            {/* Figure 2: Mid Left */}
            <g transform="translate(68, 131)">
              <circle cx="0" cy="-6" r="3.5" fill="#FAF7F0" stroke="#4E3629" strokeWidth="1.8" />
              <path d="M-4,10 L-4,0 Q0,-1 4,0 L4,10" fill="#FAF7F0" stroke="#4E3629" strokeWidth="1.8" />
            </g>
            {/* Figure 3: Mid Right */}
            <g transform="translate(132, 131)">
              <circle cx="0" cy="-6" r="3.5" fill="#FAF7F0" stroke="#4E3629" strokeWidth="1.8" />
              <path d="M-4,10 L-4,0 Q0,-1 4,0 L4,10" fill="#FAF7F0" stroke="#4E3629" strokeWidth="1.8" />
            </g>
            {/* Figure 4: Far Right */}
            <g transform="translate(155, 128)">
              <circle cx="0" cy="-6" r="3.5" fill="#FAF7F0" stroke="#4E3629" strokeWidth="1.8" />
              <path d="M-4,10 L-4,0 Q0,-1 4,0 L4,10" fill="#FAF7F0" stroke="#4E3629" strokeWidth="1.8" />
            </g>
            
            {/* Hand-holding connections */}
            <path d="M49,132 Q56,134 64,133" fill="none" stroke="#4E3629" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M72,133 Q100,138 128,133" fill="none" stroke="#4E3629" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M136,133 Q144,134 151,132" fill="none" stroke="#4E3629" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        )}

        {/* ============================================================== */}
        {/* 5. ANCIENT GREEK XENIA LOADER */}
        {/* ============================================================== */}
        {loaderType === 'XENIA' && (
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {/* Greek pottery patterns or border framing */}
            <circle cx="100" cy="100" r="92" fill="none" stroke="#EADFC9" strokeWidth="1" strokeDasharray="3 6" />
            <circle cx="100" cy="100" r="82" fill="none" stroke="#EADFC9" strokeWidth="0.5" />
            
            {/* The Gateway (Temple/Home Entrance) */}
            {/* Base platform */}
            <rect x="40" y="145" width="120" height="15" fill="#FAF7F0" stroke="#4E3629" strokeWidth="2" rx="1.5" />
            <rect x="45" y="140" width="110" height="6" fill="#FAF7F0" stroke="#4E3629" strokeWidth="1.5" rx="1" />
            
            {/* Columns */}
            {/* Left Column */}
            <rect x="58" y="65" width="12" height="75" fill="#FAF7F0" stroke="#4E3629" strokeWidth="2" />
            <line x1="64" y1="65" x2="64" y2="140" stroke="#4E3629" strokeWidth="1" />
            <rect x="55" y="60" width="18" height="6" fill="#FAF7F0" stroke="#4E3629" strokeWidth="1.5" rx="0.5" />
            
            {/* Right Column */}
            <rect x="130" y="65" width="12" height="75" fill="#FAF7F0" stroke="#4E3629" strokeWidth="2" />
            <line x1="136" y1="65" x2="136" y2="140" stroke="#4E3629" strokeWidth="1" />
            <rect x="127" y="60" width="18" height="6" fill="#FAF7F0" stroke="#4E3629" strokeWidth="1.5" rx="0.5" />
            
            {/* Triangular Pediment (roof top) */}
            <polygon points="50,60 100,32 150,60" fill="#FAF7F0" stroke="#4E3629" strokeWidth="2" />
            {/* Inset triangle ornament */}
            <polygon points="62,56 100,38 138,56" fill="#FAF7F0" stroke="#4E3629" strokeWidth="1" />
            <circle cx="100" cy="49" r="3" fill="#A37E58" stroke="#4E3629" strokeWidth="1" />

            {/* Hearth inside */}
            <rect x="85" y="115" width="30" height="25" fill="#E8D8B8" stroke="#4E3629" strokeWidth="1.5" rx="1" />
            {/* Warm glow */}
            <circle className="xenia-hearth-glow" cx="100" cy="120" r="16" fill="#A37E58" opacity="0.25" />
            {/* Burning flame */}
            <path className="xenia-flame" d="M94,128 Q100,108 100,114 Q100,98 104,112 Q108,102 107,114 Q107,118 111,128 Z" fill="#C87A53" />
            <path className="xenia-flame" style={{ animationDelay: '0.4s' }} d="M96,128 Q100,112 101,116 Q102,105 105,114 Q107,109 107,116 Q107,120 109,128 Z" fill="#D9A05B" />

            {/* Traveler's walking staff leaning on the left column */}
            <line x1="78" y1="75" x2="66" y2="140" stroke="#4E3629" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M78,75 Q82,72 82,76" fill="none" stroke="#4E3629" strokeWidth="2.5" strokeLinecap="round" />

            {/* Floating Welcoming Star / Sparkle */}
            <g className="xenia-star">
              <path d="M100,20 L101.5,24 L106,25 L102.5,28 L103.5,32 L100,30 L96.5,32 L97.5,28 L94,25 L98.5,24 Z" fill="#FAF7F0" stroke="#A37E58" strokeWidth="0.8" />
            </g>
          </svg>
        )}

        {/* ============================================================== */}
        {/* 6. INDONESIAN GOTONG ROYONG LOADER */}
        {/* ============================================================== */}
        {loaderType === 'GOTONG_ROYONG' && (
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {/* Background tropical hills & fields */}
            <path d="M-10,135 Q30,120 70,130 T170,120 T210,130 L210,200 L-10,200 Z" fill="#5A7052" stroke="#4E3629" strokeWidth="2.5" />
            <path d="M-10,150 Q45,138 90,145 T195,135 T210,142 L210,200 L-10,200 Z" fill="#FAF7F0" opacity="0.15" />
            
            {/* Rising Coconut Tree in background */}
            <path d="M32,135 Q34,95 24,70" fill="none" stroke="#4E3629" strokeWidth="3" strokeLinecap="round" />
            <path d="M24,70 Q14,64 6,66" fill="none" stroke="#4E3629" strokeWidth="2" strokeLinecap="round" />
            <path d="M24,70 Q28,60 26,48" fill="none" stroke="#4E3629" strokeWidth="2" strokeLinecap="round" />
            <path d="M24,70 Q38,68 46,64" fill="none" stroke="#4E3629" strokeWidth="2" strokeLinecap="round" />
            <path d="M24,70 Q16,74 8,82" fill="none" stroke="#4E3629" strokeWidth="2" strokeLinecap="round" />
            <path d="M24,70 Q34,76 40,84" fill="none" stroke="#4E3629" strokeWidth="2" strokeLinecap="round" />

            {/* The House (Traditional Indonesian Stilt House) */}
            <g className="gotong-house-sway">
              {/* Stilts */}
              <line x1="80" y1="110" x2="80" y2="135" stroke="#4E3629" strokeWidth="2.5" />
              <line x1="95" y1="110" x2="95" y2="135" stroke="#4E3629" strokeWidth="2.5" />
              <line x1="110" y1="110" x2="110" y2="135" stroke="#4E3629" strokeWidth="2.5" />
              <line x1="125" y1="110" x2="125" y2="135" stroke="#4E3629" strokeWidth="2.5" />
              
              {/* House Body */}
              <rect x="72" y="75" width="60" height="35" fill="#E8D8B8" stroke="#4E3629" strokeWidth="2.5" rx="1.5" />
              {/* Window */}
              <rect x="80" y="85" width="10" height="12" fill="#FAF7F0" stroke="#4E3629" strokeWidth="1.5" rx="0.5" />
              <line x1="85" y1="85" x2="85" y2="97" stroke="#4E3629" strokeWidth="1" />
              {/* Door */}
              <rect x="110" y="85" width="12" height="25" fill="#FAF7F0" stroke="#4E3629" strokeWidth="1.5" rx="0.5" />
              
              {/* High Curved Saddle Roof (Minangkabau/Toraja style) */}
              <path d="M62,75 Q102,68 142,75 L148,52 Q102,60 56,52 Z" fill="#3F6D66" stroke="#4E3629" strokeWidth="2.5" />
              {/* Roof carvings decoration */}
              <line x1="68" y1="73" x2="136" y2="73" stroke="#FAF7F0" strokeWidth="1" strokeDasharray="3 3" />

              {/* Bamboo carrying poles (the collective lifting) */}
              <line x1="50" y1="126" x2="152" y2="126" stroke="#4E3629" strokeWidth="3" strokeLinecap="round" />
              <line x1="55" y1="129" x2="147" y2="129" stroke="#E8D8B8" strokeWidth="1" />
              
              {/* Lifting Hands / Helpers under poles */}
              {/* Helper 1 */}
              <g transform="translate(62, 134)">
                <circle cx="0" cy="-3" r="1.8" fill="#FAF7F0" stroke="#4E3629" strokeWidth="1" />
                <path d="M-2,6 L-2,0 Q0,-0.5 2,0 L2,6" fill="#FAF7F0" stroke="#4E3629" strokeWidth="1" />
              </g>
              {/* Helper 2 */}
              <g transform="translate(102, 134)">
                <circle cx="0" cy="-3" r="1.8" fill="#FAF7F0" stroke="#4E3629" strokeWidth="1" />
                <path d="M-2,6 L-2,0 Q0,-0.5 2,0 L2,6" fill="#FAF7F0" stroke="#4E3629" strokeWidth="1" />
              </g>
              {/* Helper 3 */}
              <g transform="translate(138, 134)">
                <circle cx="0" cy="-3" r="1.8" fill="#FAF7F0" stroke="#4E3629" strokeWidth="1" />
                <path d="M-2,6 L-2,0 Q0,-0.5 2,0 L2,6" fill="#FAF7F0" stroke="#4E3629" strokeWidth="1" />
              </g>
            </g>
          </svg>
        )}

        {/* ============================================================== */}
        {/* 7. KENYAN HARAMBEE LOADER */}
        {/* ============================================================== */}
        {loaderType === 'HARAMBEE' && (
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {/* Kenyan sun rising in background */}
            <circle cx="100" cy="150" r="60" fill="#FAF0E0" opacity="0.3" />
            <circle cx="100" cy="150" r="40" fill="#F8E3C9" opacity="0.4" />
            
            {/* Ground line */}
            <line x1="10" y1="150" x2="190" y2="150" stroke="#4E3629" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 0,150 Q 100,147 200,150 L 200,200 L 0,200 Z" fill="#EADFC9" opacity="0.4" />

            {/* Rising/Growing Sapling in the center (representing public good / community build) */}
            <g transform="translate(100, 150)">
              {/* Soil mound */}
              <path d="M-20,0 C-12,-6 12,-6 20,0 Z" fill="#FAF7F0" stroke="#4E3629" strokeWidth="1.8" />
              <path d="M-15,-2 C-8,-7 8,-7 15,-2 Z" fill="#E8D8B8" />

              {/* Main Sapling Stem */}
              <path d="M0,0 Q-3,-20 -1,-45" fill="none" stroke="#4E3629" strokeWidth="2.5" strokeLinecap="round" />
              
              {/* Left Branch */}
              <path d="M-1,-22 Q-10,-24 -14,-32" fill="none" stroke="#4E3629" strokeWidth="1.8" strokeLinecap="round" />
              
              {/* Right Branch */}
              <path d="M-1,-12 Q10,-14 15,-20" fill="none" stroke="#4E3629" strokeWidth="1.8" strokeLinecap="round" />

              {/* Leaves */}
              {/* Top Leaf */}
              <path className="harambee-leaf" d="M-1,-45 C0,-53 8,-51 6,-46 C4,-42 -2,-41 -1,-45 Z" fill="#5A7052" stroke="#4E3629" strokeWidth="1.2" />
              
              {/* Left Leaf */}
              <path className="harambee-leaf" style={{ animationDelay: '0.8s' }} d="M-14,-32 C-21,-35 -21,-27 -17,-25 C-14,-23 -11,-28 -14,-32 Z" fill="#5A7052" stroke="#4E3629" strokeWidth="1.2" />
              
              {/* Right Leaf */}
              <path className="harambee-leaf" style={{ animationDelay: '1.6s' }} d="M15,-20 C22,-22 23,-14 19,-12 C16,-10 12,-16 15,-20 Z" fill="#5A7052" stroke="#4E3629" strokeWidth="1.2" />

              {/* Small Bud Leaf (alternate left) */}
              <path className="harambee-leaf" style={{ animationDelay: '2.2s' }} d="M-1,-32 C-5,-35 -8,-30 -5,-28 C-3,-26 0,-29 -1,-32 Z" fill="#5A7052" stroke="#4E3629" strokeWidth="1" />
            </g>

            {/* Figures on both sides collaborating to lift or support */}
            {/* Left figure */}
            <g className="harambee-helper-left" transform="translate(68, 150)">
              <circle cx="-5" cy="-28" r="4.5" fill="#FAF7F0" stroke="#4E3629" strokeWidth="2" />
              <path d="M0,0 L-4,-18 Q-10,-20 -10,-12 L-10,0" fill="none" stroke="#4E3629" strokeWidth="2.2" strokeLinecap="round" />
              {/* Arm reaching out to sprout */}
              <path d="M-4,-15 Q6,-15 15,-10" fill="none" stroke="#4E3629" strokeWidth="2.2" strokeLinecap="round" />
            </g>

            {/* Right figure */}
            <g className="harambee-helper-right" transform="translate(132, 150)">
              <circle cx="5" cy="-28" r="4.5" fill="#FAF7F0" stroke="#4E3629" strokeWidth="2" />
              <path d="M0,0 L4,-18 Q10,-20 10,-12 L10,0" fill="none" stroke="#4E3629" strokeWidth="2.2" strokeLinecap="round" />
              {/* Arm reaching out to sprout */}
              <path d="M4,-15 Q-6,-15 -15,-10" fill="none" stroke="#4E3629" strokeWidth="2.2" strokeLinecap="round" />
            </g>

            {/* Glowing sparkle above sprout */}
            <path className="harambee-sparkle" d="M100,95 L101.5,98 L105,98.5 L102,101 L103,104.5 L100,103 L97,104.5 L98,101 L95,98.5 L98.5,98 Z" fill="#FAF7F0" stroke="#9C4F3C" strokeWidth="0.8" />
          </svg>
        )}

        {/* ============================================================== */}
        {/* 8. PACIFIC NORTHWEST INDIGENOUS POTLACH LOADER */}
        {/* ============================================================== */}
        {loaderType === 'POTLACH' && (
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {/* Pacific Northwest Coast background - cedar trees silhouette */}
            <path d="M15,150 L20,110 L25,150 L30,120 L35,150 Z" fill="#5B6B56" stroke="#4E3629" strokeWidth="1.5" />
            <path d="M165,150 L170,105 L175,150 L180,115 L185,150 Z" fill="#5B6B56" stroke="#4E3629" strokeWidth="1.5" />
            
            {/* Ground line */}
            <line x1="10" y1="150" x2="190" y2="150" stroke="#4E3629" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 0,150 Q 100,148 200,150 L 200,200 L 0,200 Z" fill="#EADFC9" opacity="0.4" />

            {/* Cedar Longhouse */}
            <polygon points="50,150 50,100 100,75 150,100 150,150" fill="#E8D8B8" stroke="#4E3629" strokeWidth="2.2" />
            {/* Roof beams */}
            <line x1="44" y1="103" x2="100" y2="72" stroke="#4E3629" strokeWidth="3" strokeLinecap="round" />
            <line x1="156" y1="103" x2="100" y2="72" stroke="#4E3629" strokeWidth="3" strokeLinecap="round" />
            {/* Doorway */}
            <rect x="88" y="115" width="24" height="35" fill="#FAF7F0" stroke="#4E3629" strokeWidth="2" rx="1" />

            {/* Fire in front of the house */}
            <line x1="90" y1="148" x2="110" y2="148" stroke="#4E3629" strokeWidth="3" strokeLinecap="round" />
            <path className="potlach-flame" d="M93,146 Q100,132 100,136 Q100,125 104,134 Q108,128 107,136 Q107,138 111,146 Z" fill="#B35C37" />
            
            {/* Traditional Copper Shield (A symbol of prestige and wealth in Potlatch) */}
            <g className="potlach-copper" transform="translate(100, 105)">
              {/* Copper shield shape (keyhole-spade shield) */}
              <path d="M-8,-14 L8,-14 L8,-2 C8,2 2,5 0,7 C-2,5 -8,2 -8,-2 Z" fill="#FAF7F0" stroke="#4E3629" strokeWidth="1.8" />
              {/* Cross engraving inside copper */}
              <line x1="0" y1="-14" x2="0" y2="7" stroke="#4E3629" strokeWidth="1" />
              <line x1="-8" y1="-6" x2="8" y2="-6" stroke="#4E3629" strokeWidth="1" />
            </g>
          </svg>
        )}

        {/* ============================================================== */}
        {/* 9. MIDDLE EASTERN SADAQAH & SABIL LOADER */}
        {/* ============================================================== */}
        {loaderType === 'SADAQAH' && (
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {/* Warm desert sand dunes */}
            <path d="M-10,140 Q50,120 110,135 T210,125 L210,200 L-10,200 Z" fill="#EADFC9" stroke="#4E3629" strokeWidth="2" opacity="0.6" />
            <path d="M-10,155 Q60,145 130,158 T210,150 L210,200 L-10,200 Z" fill="#FAF7F0" opacity="0.3" />
            
            {/* Sun/Moon */}
            <circle cx="150" cy="55" r="14" fill="#FAF7F0" stroke="#4E3629" strokeWidth="1.5" />

            {/* Clay Jars Stand */}
            {/* Wooden posts */}
            <line x1="75" y1="130" x2="75" y2="165" stroke="#4E3629" strokeWidth="2.5" />
            <line x1="125" y1="130" x2="125" y2="165" stroke="#4E3629" strokeWidth="2.5" />
            <line x1="70" y1="135" x2="130" y2="135" stroke="#4E3629" strokeWidth="3" strokeLinecap="round" />

            {/* The Clay Amphora (Sabīl Jar) */}
            <g transform="translate(100, 115) rotate(12)">
              {/* Jar body */}
              <ellipse cx="0" cy="0" rx="16" ry="18" fill="#FAF7F0" stroke="#4E3629" strokeWidth="2.2" />
              {/* Neck */}
              <path d="M-6,-18 L-8,-26 L8,-26 L6,-18" fill="#FAF7F0" stroke="#4E3629" strokeWidth="2" />
              {/* Rim */}
              <ellipse cx="0" cy="-26" rx="8" ry="2.2" fill="#EADFC9" stroke="#4E3629" strokeWidth="1.5" />
              {/* Handle Left */}
              <path d="M-16,-4 Q-22,-12 -8,-22" fill="none" stroke="#4E3629" strokeWidth="1.8" />
              {/* Handle Right */}
              <path d="M16,-4 Q22,-12 8,-22" fill="none" stroke="#4E3629" strokeWidth="1.8" />
            </g>

            {/* Drinking Basin at the bottom */}
            <path d="M85,160 C85,172 115,172 115,160 Z" fill="#FAF7F0" stroke="#4E3629" strokeWidth="2" />

            {/* Water droplets dripping from the jar neck down to the basin */}
            <circle className="sadaqah-drop-1" cx="95" cy="100" r="2.2" fill="#C59B73" stroke="#4E3629" strokeWidth="0.8" />
            <circle className="sadaqah-drop-2" cx="95" cy="100" r="2.2" fill="#C59B73" stroke="#4E3629" strokeWidth="0.8" />
          </svg>
        )}

        {/* ============================================================== */}
        {/* 10. JAPANESE YUI LOADER */}
        {/* ============================================================== */}
        {loaderType === 'YUI' && (
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {/* Mountains silhouette in background */}
            <path d="M-10,135 L45,90 L90,130 L155,75 L210,125 L210,200 L-10,200 Z" fill="#FAF5E8" />
            <path d="M-10,145 Q50,135 110,145 T210,138 L210,200 L-10,200 Z" fill="#EADFC9" opacity="0.3" />

            {/* Ground line */}
            <line x1="10" y1="150" x2="190" y2="150" stroke="#4E3629" strokeWidth="2.5" strokeLinecap="round" />

            {/* Gassho-zukuri (Steep thatched roof cottage) */}
            {/* Main wooden base structure */}
            <rect x="75" y="115" width="50" height="35" fill="#FAF7F0" stroke="#4E3629" strokeWidth="2.2" rx="1.5" />
            {/* Wooden columns pattern */}
            <line x1="85" y1="115" x2="85" y2="150" stroke="#4E3629" strokeWidth="1.5" />
            <line x1="100" y1="115" x2="100" y2="150" stroke="#4E3629" strokeWidth="1.5" />
            <line x1="115" y1="115" x2="115" y2="150" stroke="#4E3629" strokeWidth="1.5" />
            {/* Sliding paper door (Shoji) */}
            <rect x="90" y="125" width="20" height="25" fill="#FAF5E8" stroke="#4E3629" strokeWidth="1.2" rx="0.5" />
            <line x1="100" y1="125" x2="100" y2="150" stroke="#4E3629" strokeWidth="1" />
            <line x1="90" y1="133" x2="110" y2="133" stroke="#4E3629" strokeWidth="0.8" />
            <line x1="90" y1="141" x2="110" y2="141" stroke="#4E3629" strokeWidth="0.8" />

            {/* Steep Roof A-Frame (Gassho style) */}
            <polygon points="50,118 100,50 150,118" fill="#E8D8B8" stroke="#4E3629" strokeWidth="2.5" />
            {/* Roof thatch texture ridges */}
            <line x1="60" y1="105" x2="100" y2="50" stroke="#AF8A3C" strokeWidth="3.5" />
            <line x1="140" y1="105" x2="100" y2="50" stroke="#AF8A3C" strokeWidth="3.5" />
            <line x1="70" y1="92" x2="100" y2="50" stroke="#AF8A3C" strokeWidth="2" />
            <line x1="130" y1="92" x2="100" y2="50" stroke="#AF8A3C" strokeWidth="2" />

            {/* Ladder leaning against the roof */}
            <line x1="60" y1="150" x2="88" y2="85" stroke="#4E3629" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="67" y1="150" x2="95" y2="85" stroke="#4E3629" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="62" y1="140" x2="70" y2="140" stroke="#4E3629" strokeWidth="1.5" />
            <line x1="66" y1="130" x2="74" y2="130" stroke="#4E3629" strokeWidth="1.5" />
            <line x1="70" y1="120" x2="78" y2="120" stroke="#4E3629" strokeWidth="1.5" />
            <line x1="75" y1="110" x2="83" y2="110" stroke="#4E3629" strokeWidth="1.5" />
            <line x1="79" y1="100" x2="87" y2="100" stroke="#4E3629" strokeWidth="1.5" />
            <line x1="83" y1="90" x2="91" y2="90" stroke="#4E3629" strokeWidth="1.5" />

            {/* Helper 1: Bottom of the ladder passing thatch */}
            <g transform="translate(52, 150)">
              <circle cx="0" cy="-22" r="3.5" fill="#FAF7F0" stroke="#4E3629" strokeWidth="1.5" />
              <path d="M-3,0 L-3,-14 C-3,-17 3,-17 3,-14 L3,0" fill="none" stroke="#4E3629" strokeWidth="1.8" strokeLinecap="round" />
              {/* Arms up passing */}
              <path d="M-3,-12 Q6,-15 12,-10" fill="none" stroke="#4E3629" strokeWidth="1.8" strokeLinecap="round" />
            </g>

            {/* Helper 2: On the roof laying thatch */}
            <g transform="translate(112, 85)">
              <circle cx="0" cy="-18" r="3" fill="#FAF7F0" stroke="#4E3629" strokeWidth="1.5" />
              <path d="M-2,10 L-2,0 C-2,-3 2,-3 2,0 L2,10" fill="none" stroke="#4E3629" strokeWidth="1.5" strokeLinecap="round" />
              {/* Arm reaching for thatch */}
              <path d="M-2,-3 Q-10,-5 -12,2" fill="none" stroke="#4E3629" strokeWidth="1.5" strokeLinecap="round" />
            </g>

            {/* Thatch bundle traveling up the ladder */}
            <g className="yui-thatch">
              {/* Grass bundle drawing */}
              <path d="M-6,0 Q0,-4 6,0 Q4,8 -6,0" fill="#E8D8B8" stroke="#4E3629" strokeWidth="1" />
              <line x1="-3" y1="2" x2="3" y2="2" stroke="#AF8A3C" strokeWidth="1" />
              <line x1="-5" y1="1" x2="5" y2="1" stroke="#4E3629" strokeWidth="0.8" />
            </g>
          </svg>
        )}

        {/* ============================================================== */}
        {/* 11. CHEROKEE GADUGI LOADER */}
        {/* ============================================================== */}
        {loaderType === 'GADUGI' && (
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {/* Rising sun backdrop */}
            <circle cx="100" cy="150" r="55" fill="#FAF0E0" opacity="0.4" />
            <circle cx="100" cy="150" r="35" fill="#F8E3C9" opacity="0.5" />

            {/* Ground line */}
            <line x1="10" y1="150" x2="190" y2="150" stroke="#4E3629" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 0,150 Q 100,147 200,150 L 200,200 L 0,200 Z" fill="#EADFC9" opacity="0.4" />

            {/* Cherokee Corn/Maize plant 1 (Left) */}
            <g transform="translate(65, 148)">
              <g className="gadugi-corn-1">
                {/* Stem */}
                <path d="M0,0 Q-4,-25 0,-50" fill="none" stroke="#4E3629" strokeWidth="2.2" />
                {/* Broad swaying leaves */}
                <path d="M-1,-20 Q-15,-28 -18,-15 C-12,-12 -4,-10 -1,-20" fill="#4E7C59" stroke="#4E3629" strokeWidth="1.2" />
                <path d="M0,-35 Q15,-40 22,-28 C14,-26 5,-25 0,-35" fill="#4E7C59" stroke="#4E3629" strokeWidth="1.2" />
                {/* Growing golden ear of corn */}
                <path d="M0,-28 Q8,-32 10,-24 Q4,-18 0,-28" fill="#D9A05B" stroke="#4E3629" strokeWidth="1.2" />
                <line x1="3" y1="-28" x2="7" y2="-22" stroke="#4E3629" strokeWidth="0.8" />
              </g>
            </g>

            {/* Cherokee Corn/Maize plant 2 (Far Left) */}
            <g transform="translate(40, 148)">
              <g className="gadugi-corn-2">
                <path d="M0,0 Q3,-20 0,-40" fill="none" stroke="#4E3629" strokeWidth="1.8" />
                <path d="M0,-15 Q-10,-22 -14,-12 C-9,-10 -3,-8 0,-15" fill="#4E7C59" stroke="#4E3629" strokeWidth="1" />
                <path d="M0,-26 Q12,-30 15,-20 C10,-18 4,-18 0,-26" fill="#4E7C59" stroke="#4E3629" strokeWidth="1" />
              </g>
            </g>

            {/* Woven Cherokee basket in the center right (receiving the harvest) */}
            <g className="gadugi-basket" transform="translate(115, 122)">
              {/* Basket base outline */}
              <path d="M0,10 L30,10 L26,26 L4,26 Z" fill="#E8D8B8" stroke="#4E3629" strokeWidth="2" />
              {/* Woven checks texture */}
              <path d="M4,15 L26,15 M6,20 L24,20 M7,25 L23,25" fill="none" stroke="#4E7C59" strokeWidth="1.5" strokeDasharray="3 2" />
              <line x1="8" y1="10" x2="10" y2="26" stroke="#4E3629" strokeWidth="1" />
              <line x1="15" y1="10" x2="15" y2="26" stroke="#4E3629" strokeWidth="1" />
              <line x1="22" y1="10" x2="20" y2="26" stroke="#4E3629" strokeWidth="1" />

              {/* Harvested corn inside the basket */}
              <path d="M4,10 C4,5 8,2 10,7" stroke="#4E3629" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              <path d="M5,10 C8,4 12,2 14,8" stroke="#D9A05B" strokeWidth="3" strokeLinecap="round" fill="none" />
              <path d="M12,10 C15,3 20,2 22,8" stroke="#D9A05B" strokeWidth="3.5" strokeLinecap="round" fill="none" />
              <path d="M18,10 C22,4 26,6 25,10" stroke="#4E3629" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            </g>

            {/* Helper 3: Cherokee community member working in the field */}
            <g transform="translate(150, 150)">
              <g className="gadugi-helper">
                <circle cx="-5" cy="-26" r="4.2" fill="#FAF7F0" stroke="#4E3629" strokeWidth="1.8" />
                <path d="M0,0 L-4,-17 Q-10,-19 -10,-11 L-10,0" fill="none" stroke="#4E3629" strokeWidth="2.2" strokeLinecap="round" />
                {/* Reaching arm tending the corn basket */}
                <path d="M-4,-14 Q-16,-14 -22,-8" fill="none" stroke="#4E3629" strokeWidth="2" strokeLinecap="round" />
              </g>
            </g>

            {/* Sparkling active community star above harvest */}
            <path className="harambee-sparkle" d="M130,95 L131.5,98 L135,98.5 L132,101 L133,104.5 L130,103 L127,104.5 L128,101 L125,98.5 L128.5,98 Z" fill="#FAF7F0" stroke="#4E7C59" strokeWidth="0.8" />
          </svg>
        )}

        {/* ============================================================== */}
        {/* 12. WEST AFRICAN SUSU LOADER */}
        {/* ============================================================== */}
        {loaderType === 'SUSU' && (
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {/* Sunset concentric rings for background depth */}
            <circle cx="100" cy="105" r="75" fill="none" stroke="#EADFC9" strokeWidth="0.6" strokeDasharray="3 6" />
            <circle cx="100" cy="105" r="50" fill="none" stroke="#EADFC9" strokeWidth="0.6" />

            {/* Central Clay Pot (the communal pot of trust/savings) */}
            <g transform="translate(100, 105)">
              {/* Base shadow */}
              <ellipse cx="0" cy="20" rx="22" ry="5" fill="#FAF0E0" opacity="0.8" />
              
              {/* Pot body */}
              <path d="M-22,-4 C-32,5 -28,22 -15,22 L15,22 C28,22 32,5 22,-4 Z" fill="#FAF7F0" stroke="#4E3629" strokeWidth="2.5" />
              {/* Neck & rim */}
              <path d="M-15,-4 L-18,-12 L18,-12 L15,-4" fill="#FAF7F0" stroke="#4E3629" strokeWidth="2.2" />
              <ellipse cx="0" cy="-12" rx="18" ry="4" fill="#EADFC9" stroke="#4E3629" strokeWidth="1.8" />

              {/* Woven patterns on the clay pot body */}
              <path d="M-20,6 L20,6 M-15,12 L15,12" fill="none" stroke="#4F688B" strokeWidth="1.5" strokeDasharray="4 2" />
              <path d="M-8,6 L-12,12 M8,6 L12,12 M0,6 L0,12" fill="none" stroke="#4E3629" strokeWidth="1" />

              {/* Golden sparks rising from the savings pot */}
              <path className="harambee-sparkle" style={{ transform: 'translate(-5px, -24px) scale(0.6)' }} d="M0,0 L2,5 L7,6 L3,10 L4,15 L0,12 L-4,15 L-3,10 L-7,6 L-2,5 Z" fill="#FAF7F0" stroke="#D9A05B" strokeWidth="0.8" />
              <path className="harambee-sparkle" style={{ transform: 'translate(8px, -28px) scale(0.5)', animationDelay: '1s' }} d="M0,0 L2,5 L7,6 L3,10 L4,15 L0,12 L-4,15 L-3,10 L-7,6 L-2,5 Z" fill="#FAF7F0" stroke="#D9A05B" strokeWidth="0.8" />
            </g>

            {/* Three rotating Susu gold/bronze coins/tokens representing cycles of fund sharing */}
            {/* Coin 1 */}
            <g className="susu-coin-1">
              <circle cx="100" cy="105" r="9" fill="#FAF5E8" stroke="#4E3629" strokeWidth="1.8" />
              <circle cx="100" cy="105" r="5" fill="#D9A05B" stroke="#4E3629" strokeWidth="1" />
              <line x1="100" y1="102" x2="100" y2="108" stroke="#4E3629" strokeWidth="0.8" />
              <line x1="97" y1="105" x2="103" y2="105" stroke="#4E3629" strokeWidth="0.8" />
            </g>

            {/* Coin 2 */}
            <g className="susu-coin-2">
              <circle cx="100" cy="105" r="9" fill="#FAF5E8" stroke="#4E3629" strokeWidth="1.8" />
              <circle cx="100" cy="105" r="5" fill="#D9A05B" stroke="#4E3629" strokeWidth="1" />
              <line x1="100" y1="102" x2="100" y2="108" stroke="#4E3629" strokeWidth="0.8" />
              <line x1="97" y1="105" x2="103" y2="105" stroke="#4E3629" strokeWidth="0.8" />
            </g>

            {/* Coin 3 */}
            <g className="susu-coin-3">
              <circle cx="100" cy="105" r="9" fill="#FAF5E8" stroke="#4E3629" strokeWidth="1.8" />
              <circle cx="100" cy="105" r="5" fill="#D9A05B" stroke="#4E3629" strokeWidth="1" />
              <line x1="100" y1="102" x2="100" y2="108" stroke="#4E3629" strokeWidth="0.8" />
              <line x1="97" y1="105" x2="103" y2="105" stroke="#4E3629" strokeWidth="0.8" />
            </g>
          </svg>
        )}

      </div>

      <div className="mt-6 h-8 flex items-center justify-center">
        <p style={{ color: activeProfile.color }} className="font-serif text-sm italic transition-all duration-500 animate-pulse font-medium">
          {activeProfile.messages[messageIndex]}
        </p>
      </div>

      {showLearnMore && (
        <button
          onClick={() => setIsModalOpen(true)}
          className="absolute top-6 right-6 z-10 px-3.5 py-1.5 bg-[#FAF7F0]/90 backdrop-blur-sm border border-[#EADFC9] text-[#4E3629] text-xs font-serif italic rounded-full shadow-sm hover:bg-[#EADFC9]/50 transition-all duration-200 cursor-pointer flex items-center gap-1.5"
        >
          <span>Learn more about {traditionDetails[loaderType].title}</span>
          <span className="text-[10px] font-sans">➔</span>
        </button>
      )}

      {isModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#FAF7F0] border border-[#EADFC9] w-full max-w-sm rounded-3xl p-6 shadow-2xl relative flex flex-col text-left gap-4 max-h-[90%] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span style={{ color: activeProfile.color }} className="text-[10px] font-black uppercase tracking-widest">
                  Tradition Spotlight
                </span>
                <h3 className="font-serif text-2xl font-bold text-[#4E3629] mt-0.5">
                  {traditionDetails[loaderType].title}
                </h3>
                <p className="text-xs text-stone-500 font-serif italic mt-0.5">
                  Origin: {traditionDetails[loaderType].origin}
                </p>
              </div>
              <div style={{ backgroundColor: `${activeProfile.color}15`, color: activeProfile.color }} className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border border-dashed border-stone-300 shrink-0">
                {loaderType === 'KULA' ? '🎁' : 
                 loaderType === 'IMECE' ? '🤝' : 
                 loaderType === 'AYNI' ? '🌾' : 
                 loaderType === 'UBUNTU' ? '🔥' : 
                 loaderType === 'XENIA' ? '🏛️' : 
                 loaderType === 'GOTONG_ROYONG' ? '🏠' : 
                 loaderType === 'HARAMBEE' ? '🌱' : 
                 loaderType === 'POTLACH' ? '🪵' : 
                 loaderType === 'SADAQAH' ? '🏺' :
                 loaderType === 'YUI' ? '🛖' :
                 loaderType === 'GADUGI' ? '🌽' : '🪙'}
              </div>
            </div>
            
            <div className="border-t border-[#EADFC9]/60 my-0.5" />
            
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-600 mb-1">
                The Practice
              </h4>
              <p className="text-xs text-[#4E3629] leading-relaxed">
                {traditionDetails[loaderType].description}
              </p>
            </div>

            <div className="bg-stone-50 p-4 rounded-2xl border border-[#EADFC9]/40">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-600 mb-1 flex items-center gap-1.5">
                <span>✨</span>
                <span>The Spirit</span>
              </h4>
              <p className="text-xs text-[#4E3629] italic leading-relaxed">
                {traditionDetails[loaderType].spirit}
              </p>
            </div>

            {traditionDetails[loaderType].reference && (
              <div className="border-t border-[#EADFC9]/30 pt-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-1">
                  Reference & Scholarship
                </h4>
                <p className="text-[10px] text-stone-500 font-serif italic leading-relaxed">
                  {traditionDetails[loaderType].reference}
                </p>
              </div>
            )}

            <button
              onClick={() => setIsModalOpen(false)}
              className="mt-2 w-full py-2.5 bg-brand hover:bg-brand-deep text-white text-xs font-black uppercase tracking-wider rounded-xl active:scale-[0.98] transition-all shadow-sm text-center cursor-pointer"
            >
              Understood & Inspired
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default GlobalTraditionsLoader;
