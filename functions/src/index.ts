import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

admin.initializeApp();

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

export const seed = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  try {
    const { baseLocation, callerUid } = req.body;
    const loc = baseLocation || { lat: 52.5200, lng: 13.4050 };

    console.log("Restoring Circles and Invites...");

    // Neighbors
    const neighbors = [
      { uid: "u1", displayName: "Marta Schmidt", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marta" },
      { uid: "u2", displayName: "Lukas Weber", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Lukas" },
      { uid: "u3", displayName: "Aya Tanaka", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aya" },
      { uid: "u4", displayName: "Sven Müller", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sven" },
      { uid: "u5", displayName: "Elena Petrova", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Elena" },
      { uid: "u6", displayName: "Faisal Khan", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Faisal" },
      { uid: "u7", displayName: "Greta Braun", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Greta" },
      { uid: "u8", displayName: "Henry Davis", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Henry" },
      { uid: "u9", displayName: "Sophie Laurent", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sophie" },
      { uid: "u10", displayName: "Jakob Fischer", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jakob" }
    ];

    // Circles
    const seedCircles = [
      { id: 'c_garden', name: "Boxi Urban Gardeners", description: "Sharing seeds, tools, and harvest from our neighborhood gardens.", privacy: "PUBLIC" },
      { id: 'c_fixit', name: "Altbau Fixers", description: "Helping each other maintain and renovate our beautiful old apartments.", privacy: "PUBLIC" },
      { id: 'c_parents', name: "Prenzlauer Berg Parents", description: "Connecting families for childcare, playdates, and gear swap.", privacy: "PUBLIC" },
      { id: 'c_tech', name: "Tech for Good Berlin", description: "Volunteering our tech skills for local social projects.", privacy: "PUBLIC" },
      { id: 'c_music', name: "Neukölln Musicians", description: "Jam sessions, gear sharing, and rehearsal space connections.", privacy: "PUBLIC" }
    ];

    // Deep Wipe
    const cols = ['users', 'items', 'circles', 'chats', 'messages', 'swipes', 'notifications', 'reviews', 'gratitude_notes'];
    for (const col of cols) {
      const snap = await db.collection(col).get();
      for (const doc of snap.docs) {
        if (col === 'users' && callerUid && doc.id === callerUid) continue;

        if (col === 'items') {
          const comments = await doc.ref.collection('comments').get();
          for (const c of comments.docs) await c.ref.delete();
        }
        await doc.ref.delete();
      }
    }

    const batch = db.batch();

    // Trust mosaic data per user
    const mosaicData: Record<string, any> = {
      u1:  { completedExchanges: 18, imeceParticipations: 4, circleCount: 3, vouchCount: 5 },
      u2:  { completedExchanges: 12, imeceParticipations: 6, circleCount: 2, vouchCount: 3 },
      u3:  { completedExchanges: 7,  imeceParticipations: 2, circleCount: 2, vouchCount: 2 },
      u4:  { completedExchanges: 22, imeceParticipations: 3, circleCount: 4, vouchCount: 6 },
      u5:  { completedExchanges: 15, imeceParticipations: 8, circleCount: 3, vouchCount: 4 },
      u6:  { completedExchanges: 5,  imeceParticipations: 1, circleCount: 2, vouchCount: 1 },
      u7:  { completedExchanges: 25, imeceParticipations: 10, circleCount: 5, vouchCount: 7 },
      u8:  { completedExchanges: 9,  imeceParticipations: 2, circleCount: 1, vouchCount: 2 },
      u9:  { completedExchanges: 3,  imeceParticipations: 1, circleCount: 1, vouchCount: 0 },
      u10: { completedExchanges: 14, imeceParticipations: 5, circleCount: 3, vouchCount: 4 }
    };

    // Invite chain mapping
    const inviteChain: Record<string, string | null> = {
      u1: callerUid || null, // Marta invited by you!
      u2: 'u1',       // Lukas invited by Marta
      u3: 'u1',       // Aya invited by Marta
      u4: 'u2',       // Sven invited by Lukas
      u5: 'u1',       // Elena invited by Marta
      u6: 'u5',       // Faisal invited by Elena
      u7: 'u1',       // Greta invited by Marta
      u8: 'u7',       // Henry invited by Greta
      u9: 'u8',       // Sophie invited by Henry
      u10: 'u7'       // Jakob invited by Greta
    };

    // Users
    for (const u of neighbors) {
      batch.set(db.collection('users').doc(u.uid), {
        ...u,
        isAdmin: false,
        createdAt: FieldValue.serverTimestamp(),
        hasCompletedOnboarding: true,
        location: { lat: loc.lat + (Math.random() - 0.5) * 0.01, lng: loc.lng + (Math.random() - 0.5) * 0.01 },
        joinedCircles: [],
        trustMosaic: mosaicData[u.uid] || { completedExchanges: 0, imeceParticipations: 0, circleCount: 0, vouchCount: 0 },
        hostId: inviteChain[u.uid] || 'u1',
        hostStatus: 'APPROVED',
        inviteCode: u.uid.toUpperCase() + 'CODE' // Consistent codes for testing
      });
    }

    // Gratitude Notes
    const gratitudeNotes = [
      { from: "u5", fromName: "Elena Petrova", to: "u1", itemTitle: "Sourdough Starter", text: "🤝 Marta's sourdough starter changed my mornings. The guide she printed was so thoughtful. Danke!" },
      { from: "u2", fromName: "Lukas Weber", to: "u10", itemTitle: "Bosch Hammer Drill", text: "🙏 Jakob saved my weekend with that drill. Hung 6 shelves in one afternoon. Real Kiez spirit." },
      { from: "u3", fromName: "Aya Tanaka", to: "u5", itemTitle: "Yoga in the Park", text: "⭐ Elena's Sunday yoga is the highlight of my week. She makes everyone feel welcome." },
      { from: "u8", fromName: "Henry Davis", to: "u5", itemTitle: "Fresh Basil Pesto", text: "💚 Best pesto in Berlin, hands down. Elena is incredibly generous." },
      { from: "u9", fromName: "Sophie Laurent", to: "u1", itemTitle: "Pasta Machine", text: "🤝 Marta's pasta machine made my dinner party unforgettable. The ravioli was a hit!" },
      { from: "u6", fromName: "Faisal Khan", to: "u2", itemTitle: "Canoe for the Spree", text: "🌱 Lukas showed me the best spot to launch. What a magical afternoon on the water." },
      { from: "u1", fromName: "Marta Schmidt", to: "u7", itemTitle: "Piano Move Help", text: "🙏 Greta organized the whole piano move like a pro. Pizza and beer were the least I could do." },
      { from: "u7", fromName: "Greta Braun", to: "u10", itemTitle: "Street Library", text: "⭐ Jakob's woodworking skills brought our street library back to life. Beautiful repair work." },
      { from: "u4", fromName: "Sven Müller", to: "u3", itemTitle: "Graphic Design Tutoring", text: "🌱 Aya taught me Photoshop basics in one afternoon. So patient and clear." },
      { from: "u10", fromName: "Jakob Fischer", to: "u7", itemTitle: "Communal Garden Cleanup", text: "💚 Greta always shows up when the neighborhood needs her. Organized, warm, and reliable." },
      { from: "u3", fromName: "Aya Tanaka", to: "u6", itemTitle: "Vintage Fujifilm X-T10", text: "🤝 Faisal's camera is incredible. He even threw in a lens. This community is amazing." },
      { from: "u8", fromName: "Henry Davis", to: "u4", itemTitle: "German Translation Help", text: "🙏 Sven helped me understand my whole rental contract. A true lifesaver." },
      { from: "u5", fromName: "Elena Petrova", to: "u3", itemTitle: "Dog Sitting", text: "⭐ Aya took such great care of my friend's retriever. He didn't want to leave!" },
      { from: "u2", fromName: "Lukas Weber", to: "u4", itemTitle: "Excess Apples", text: "💚 Sven's apple tree is legendary. Made three pies and still had leftovers." },
      { from: "u9", fromName: "Sophie Laurent", to: "u4", itemTitle: "Long Ladder", text: "🤝 Sven's telescoping ladder saved my ceiling painting project. Perfectly maintained tool." }
    ];

    for (let i = 0; i < gratitudeNotes.length; i++) {
      const note = gratitudeNotes[i];
      const fromNeighbor = neighbors.find(n => n.uid === note.from);
      batch.set(db.collection('gratitude_notes').doc(`gn_${i}`), {
        id: `gn_${i}`,
        fromUserId: note.from,
        fromUserName: note.fromName,
        fromUserPhoto: fromNeighbor?.photoURL || null,
        toUserId: note.to,
        itemId: `item_${i % 30}`,
        itemTitle: note.itemTitle,
        text: note.text,
        createdAt: FieldValue.serverTimestamp()
      });
    }

    // Circles
    for (const c of seedCircles) {
      batch.set(db.collection('circles').doc(c.id), {
        ...c,
        creatorId: "u7",
        createdAt: FieldValue.serverTimestamp(),
        memberCount: 12
      });
    }

    // Threaded Items (First 15 with rich dialogue)
    const richItems = [
      {
        title: "Sourdough Starter (3 years old)",
        description: "Very active starter from my grandmother's recipe. Happy to share a jar!",
        type: "SHARE", category: "Food", ownerId: "u1",
        image: "https://images.unsplash.com/photo-1585478259715-876acc5be8eb?auto=format&fit=crop&q=80&w=400",
        dialogue: [
          { userId: "u5", userName: "Elena Petrova", text: "Oh, I've been wanting to try sourdough! Is it easy to maintain?",
            replies: [{ userId: "u1", userName: "Marta Schmidt", text: "Yes! I'll give you a guide." }] }
        ]
      },
      {
        title: "Bosch Hammer Drill",
        description: "Powerful drill for concrete walls.",
        type: "SHARE", category: "Tools", ownerId: "u10",
        image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&q=80&w=400",
        dialogue: [
          { userId: "u2", userName: "Lukas Weber", text: "Is this for 50cm concrete?",
            replies: [{ userId: "u10", userName: "Jakob Fischer", text: "Yep, heavy duty one!" }] }
        ]
      },
      {
        title: "Join 'Boxi Urban Gardeners'",
        description: "We are organizing our spring seed swap. Join us!",
        type: "CIRCLE_INVITE", category: "Garden", ownerId: "u7", circleId: "c_garden"
      },
      {
        title: "Join 'Altbau Fixers'",
        description: "Exchange tools and tips for apartment renovation.",
        type: "CIRCLE_INVITE", category: "Community", ownerId: "u7", circleId: "c_fixit"
      }
      // ... Adding more items to reach 30+ total
    ];

    // Full 30+ Items Construction
    const baseItems = [
      { title: "Canoe for the Spree", type: "SHARE", category: "Equipment", ownerId: "u2", image: "https://images.unsplash.com/photo-1540539234-c14a20fb7c7b?auto=format&fit=crop&q=80&w=400" },
      { title: "Lavender Plant Cuttings", type: "SHARE", category: "Garden", ownerId: "u5", image: "https://images.unsplash.com/photo-1471943311424-646960669fba?auto=format&fit=crop&q=80&w=400" },
      { title: "Vintage Fujifilm X-T10", type: "SHARE", category: "Electronics", ownerId: "u6", image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=400" },
      { title: "Moving Boxes (set of 10)", type: "SHARE", category: "Household", ownerId: "u8", image: "https://images.unsplash.com/photo-1524230659192-35f3458f4505?auto=format&fit=crop&q=80&w=400" },
      { title: "Fresh Basil Pesto", type: "SHARE", category: "Food", ownerId: "u5", image: "https://images.unsplash.com/photo-1551131618-3f0a5ef6e0d4?auto=format&fit=crop&q=80&w=400" },
      { title: "Need help moving a Piano", type: "ASK", category: "Service", ownerId: "u7" },
      { title: "Borrowing a long ladder", type: "ASK", category: "Tools", ownerId: "u9" },
      { title: "German-English Translation", type: "ASK", category: "Skills", ownerId: "u8" },
      { title: "Dog sitting for 2 days", type: "ASK", category: "Service", ownerId: "u3" },
      { title: "Borrowing a pasta machine", type: "ASK", category: "Kitchen", ownerId: "u1" },
      { title: "Advice on keeping lemon trees", type: "ASK", category: "Garden", ownerId: "u1" },
      { title: "Communal Garden Cleanup", type: "IMECE", category: "Environment", ownerId: "u1", circleId: "c_garden" },
      { title: "Street Library Maintenance", type: "IMECE", category: "Community", ownerId: "u4", circleId: "c_fixit" },
      { title: "Neighborhood Mural Painting", type: "IMECE", category: "Art", ownerId: "u3" },
      { title: "Bicycle Repair Workshop", type: "IMECE", category: "Skillshare", ownerId: "u2", circleId: "c_fixit" },
      { title: "Autumn Leaf Collection", type: "IMECE", category: "Service", ownerId: "u7" },
      { title: "Winter Clothing Swap", type: "MISSION", category: "Community", ownerId: "u7" },
      { title: "Save the Local Cinema", type: "MISSION", category: "Charity", ownerId: "u4" },
      { title: "Park Cleanup Day", type: "MISSION", category: "Environment", ownerId: "u10" },
      { title: "Toy Drive", type: "MISSION", category: "Charity", ownerId: "u5" },
      { title: "Community Fridge Setup", type: "MISSION", category: "Food", ownerId: "u5" },
      { title: "Graphic Design Tutoring", type: "SHARE", category: "Skills", ownerId: "u3" },
      { title: "Excess apples", type: "SHARE", category: "Food", ownerId: "u4" },
      { title: "Need help with PC setup", type: "ASK", category: "Tech", ownerId: "u4" },
      { title: "Sharing my Netflix slot", type: "SHARE", category: "Digital", ownerId: "u6" },
      { title: "Language Exchange (FR/DE)", type: "ASK", category: "Skills", ownerId: "u9" },
      { title: "Used stroller", type: "SHARE", category: "Kids", ownerId: "u8" },
      { title: "Join 'Neukölln Musicians'", type: "CIRCLE_INVITE", category: "Music", ownerId: "u7", circleId: "c_music" },
      { title: "Join 'Prenzlauer Berg Parents'", type: "CIRCLE_INVITE", category: "Kids", ownerId: "u7", circleId: "c_parents" },
      { title: "Join 'Tech for Good Berlin'", type: "CIRCLE_INVITE", category: "Tech", ownerId: "u7", circleId: "c_tech" }
    ];

    const finalItems = [...richItems, ...baseItems];

    for (let i = 0; i < finalItems.length; i++) {
      const item = finalItems[i] as any;
      const itemRef = db.collection('items').doc(`item_${i}`);
      const owner = neighbors.find(u => u.uid === item.ownerId);

      batch.set(itemRef, {
        id: `item_${i}`,
        title: item.title,
        description: item.description || "Looking for neighbors to join and collaborate.",
        type: item.type,
        category: item.category,
        ownerId: item.ownerId,
        ownerName: owner?.displayName,
        ownerPhoto: owner?.photoURL,
        location: { lat: loc.lat + (Math.random() - 0.5) * 0.015, lng: loc.lng + (Math.random() - 0.5) * 0.015 },
        createdAt: FieldValue.serverTimestamp(),
        status: 'ACTIVE',
        images: item.image ? [item.image] : [],
        reachTypes: ['VICINITY'],
        circleId: item.circleId || null,
        isSeed: true
      });

      if (item.dialogue) {
        for (let cIndex = 0; cIndex < item.dialogue.length; cIndex++) {
          const c = item.dialogue[cIndex];
          const commentId = `comment_${i}_${cIndex}`;
          batch.set(itemRef.collection('comments').doc(commentId), {
            id: commentId,
            userId: c.userId,
            userName: c.userName,
            text: c.text,
            createdAt: FieldValue.serverTimestamp()
          });
          if (c.replies) {
            for (let rIndex = 0; rIndex < c.replies.length; rIndex++) {
              const r = c.replies[rIndex];
              batch.set(itemRef.collection('comments').doc(`reply_${commentId}_${rIndex}`), {
                id: `reply_${commentId}_${rIndex}`,
                parentId: commentId,
                userId: r.userId,
                userName: r.userName,
                text: r.text,
                createdAt: FieldValue.serverTimestamp()
              });
            }
          }
        }
      }
    }

    if (callerUid) {
      batch.update(db.collection('users').doc(callerUid), {
        hasCompletedOnboarding: true,
        hostStatus: 'APPROVED',
        isAdmin: true // Ensure founder stays admin too
      });
    }

    await batch.commit();
    res.status(200).json({ success: true, message: "Restored circles and invites." });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
