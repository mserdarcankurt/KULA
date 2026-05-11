const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const startMarker = '// 2. Mock Data';
const endMarker = 'await createBatch.commit();';

const startIdx = code.indexOf(startMarker);
const endIdx = code.indexOf(endMarker, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  const newContent = `// 2. Mock Data
      const seedUsers = [
        { uid: "user_seed_0", name: "Alice Chen", thePersonFor: ["Tech mentorship", "Baking"], lookoutFor: ["Language exchange", "Board games"], bio: "Software engineer who loves baking on weekends." },
        { uid: "user_seed_1", name: "Bob Miller", thePersonFor: ["Guitar lessons", "Dog walking"], lookoutFor: ["Plant cuttings", "Local gigs"], bio: "Musician and dog lover." },
        { uid: "user_seed_2", name: "Chloe Smith", thePersonFor: ["Yoga", "Vegan cooking"], lookoutFor: ["Hiking buddies", "Used books"], bio: "Yoga instructor, always looking for a new trail." },
        { uid: "user_seed_3", name: "David Park", thePersonFor: ["Math tutoring", "Moving help"], lookoutFor: ["Language exchange", "Photography"], bio: "Student and amateur photographer." },
        { uid: "user_seed_4", name: "Emma Wagner", thePersonFor: ["Graphic design", "Plant care"], lookoutFor: ["Tech help", "Art supplies"], bio: "Freelance designer creating community art." },
        { uid: "user_seed_5", name: "Felix Becker", thePersonFor: ["Bicycle repair", "Carpentry"], lookoutFor: ["Tool sharing", "Volunteering"], bio: "I fix things and build things." },
        { uid: "user_seed_6", name: "Greta Müller", thePersonFor: ["Event planning", "Local history"], lookoutFor: ["Venue spaces", "Community projects"], bio: "History buff and neighborhood organizer." },
        { uid: "user_seed_7", name: "Hassan Ali", thePersonFor: ["Language teaching", "Cooking"], lookoutFor: ["Sports partners", "Mentorship"], bio: "Chef and football enthusiast." }
      ];

      const orgs = [
        { uid: "org_seed_green_earth", displayName: "Green Earth NGO", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=GreenEarth", isOrganization: true, orgType: "CHARITY", bio: "Local environmental charity making our city greener.", thePersonFor: ["Environmental education", "Tree planting"], lookoutFor: ["Volunteers", "Donations"], isAdmin: false, createdAt: new Date() },
        { uid: "org_seed_community_builders", displayName: "Community Builders Berlin", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=CommunityBuilders", isOrganization: true, orgType: "SOCIAL_ENTERPRISE", bio: "Helping to strengthen neighborhoods.", thePersonFor: ["Neighborhood grants", "Workshops"], lookoutFor: ["Community leaders", "Project ideas"], isAdmin: false, createdAt: new Date() },
        { uid: "org_seed_kiez_helpers", displayName: "Kiez Helpers Neukölln", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=KiezHelpers", isOrganization: true, orgType: "CHARITY", bio: "Direct action for folks in need.", thePersonFor: ["Food distribution", "Clothing drives"], lookoutFor: ["Donations", "Drivers"], isAdmin: false, createdAt: new Date() },
        { uid: "org_seed_food_saver", displayName: "Food Saver Collective", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=FoodSaver", isOrganization: true, orgType: "SOCIAL_ENTERPRISE", bio: "Rescuing food from going to waste.", thePersonFor: ["Food rescue", "Cooking events"], lookoutFor: ["Partner restaurants", "Volunteers"], isAdmin: false, createdAt: new Date() }
      ];

      const createBatch = db.batch();

      for (const org of orgs) {
        createBatch.set(db.collection('users').doc(org.uid), org, { merge: true });
      }

      for (const u of seedUsers) {
        createBatch.set(db.collection('users').doc(u.uid), {
          uid: u.uid,
          displayName: u.name,
          photoURL: \`https://api.dicebear.com/7.x/avataaars/svg?seed=\${encodeURIComponent(u.name)}\`,
          bio: u.bio,
          thePersonFor: u.thePersonFor,
          lookoutFor: u.lookoutFor,
          isAdmin: false,
          createdAt: new Date()
        }, { merge: true });
      }

      const seedCircles = [
        { id: db.collection('circles').doc().id, name: "Techies for Good", description: "Developers and designers giving back.", privacy: "PUBLIC", creatorId: "user_seed_0", isOrganizationLed: false, isSeed: true, createdAt: new Date(), memberCount: 5 },
        { id: db.collection('circles').doc().id, name: "Kreuzberg Dog Walkers", description: "Neighborly help for dog walking.", privacy: "PUBLIC", creatorId: "user_seed_1", isOrganizationLed: false, isSeed: true, createdAt: new Date(), memberCount: 12 },
        { id: db.collection('circles').doc().id, name: "Green Earth Volunteers", description: "Sustainability advocates working on local environmental projects.", privacy: "PUBLIC", creatorId: "org_seed_green_earth", isOrganizationLed: true, isSeed: true, createdAt: new Date(), memberCount: 24 },
        { id: db.collection('circles').doc().id, name: "Neukölln Freegan", description: "Sharing rescued food and tips.", privacy: "PRIVATE", creatorId: "user_seed_6", isOrganizationLed: false, isSeed: true, createdAt: new Date(), memberCount: 30 },
        { id: db.collection('circles').doc().id, name: "Local Artists Connect", description: "Canvas sharing, critiques, and gallery outings.", privacy: "PUBLIC", creatorId: "user_seed_4", isOrganizationLed: false, isSeed: true, createdAt: new Date(), memberCount: 15 },
        { id: db.collection('circles').doc().id, name: "Berlin Bike Fixers", description: "DIY bike maintenance workshops.", privacy: "PUBLIC", creatorId: "user_seed_5", isOrganizationLed: false, isSeed: true, createdAt: new Date(), memberCount: 42 }
      ];

      for (const circle of seedCircles) {
        createBatch.set(db.collection('circles').doc(circle.id), circle);
        createBatch.set(db.collection('circles').doc(circle.id).collection('members').doc(circle.creatorId), { joinedAt: new Date() });
      }

      const richMockData = [
        // 6 ASKS
        { title: "Need help carrying a couch up to Altbau 4th floor", description: "I'll provide Club-Mate and pizza for anyone who can spare 20 minutes!", type: "ASK", category: "Service", images: ["https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=1000"], status: "ACTIVE", reachTypes: ["VICINITY", "ALL_CIRCLES"], expiresAt: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 7), comments: [{ id: 'c_' + Math.random().toString(36).substr(2, 9), userId: 'user_seed_1', userName: 'Bob Miller', userPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob%20Miller', content: 'I am interested!', createdAt: new Date() }] },
        { title: "Anyone have a Schlagbohrmaschine (Hammer Drill)?", description: "Need to install shelves in concrete walls. Happy to bake cookies in return!", type: "ASK", category: "Equipment", images: ["https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Drill_scheme.svg/960px-Drill_scheme.svg.png"], status: "ACTIVE", reachTypes: ["ALL_CIRCLES"], expiresAt: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 7), comments: [{ id: 'c_' + Math.random().toString(36).substr(2, 9), userId: 'user_seed_1', userName: 'Bob Miller', userPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob%20Miller', content: 'I am interested!', createdAt: new Date() }] },
        { title: "Looking for an old acoustic guitar", description: "Can't afford a new one right now. Can trade web design work!", type: "ASK", category: "Music", images: ["https://upload.wikimedia.org/wikipedia/commons/4/45/GuitareClassique5.png"], status: "ACTIVE", reachTypes: ["VICINITY"], expiresAt: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 7), comments: [{ id: 'c_' + Math.random().toString(36).substr(2, 9), userId: 'user_seed_1', userName: 'Bob Miller', userPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob%20Miller', content: 'I am interested!', createdAt: new Date() }] },
        { title: "Borrow: Camping tent for the weekend", description: "Going to the lakes this weekend, looking to borrow a 2-person tent.", type: "ASK", category: "Equipment", images: [], status: "ACTIVE", reachTypes: ["VICINITY"], expiresAt: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 7), comments: [{ id: 'c_' + Math.random().toString(36).substr(2, 9), userId: 'user_seed_1', userName: 'Bob Miller', userPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob%20Miller', content: 'I am interested!', createdAt: new Date() }] },
        { title: "Need a cat sitter next week", description: "Going away for 5 days. My cat Mimi is very low maintenance.", type: "ASK", category: "Service", images: ["https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=1000"], status: "ACTIVE", reachTypes: ["ALL_CIRCLES", "VICINITY"], expiresAt: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 7), comments: [{ id: 'c_' + Math.random().toString(36).substr(2, 9), userId: 'user_seed_1', userName: 'Bob Miller', userPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob%20Miller', content: 'I am interested!', createdAt: new Date() }] },
        { title: "Looking for a road bike size M", description: "Anyone selling or lending a decent road bike?", type: "ASK", category: "Mobility", images: [], status: "ACTIVE", reachTypes: ["VICINITY"], expiresAt: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 7), comments: [{ id: 'c_' + Math.random().toString(36).substr(2, 9), userId: 'user_seed_1', userName: 'Bob Miller', userPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob%20Miller', content: 'I am interested!', createdAt: new Date() }] },

        // 6 SHARES
        { title: "Leftover fresh pastries from my bakery", description: "3 boxes of fresh croissants and muffins. First come, first served!", type: "SHARE", category: "Food", images: ["https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=1000"], status: "ACTIVE", reachTypes: ["VICINITY"], isFeatured: false, expiresAt: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 5), comments: [{ id: 'c_' + Math.random().toString(36).substr(2, 9), userId: 'user_seed_2', userName: 'Chloe Smith', userPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Chloe%20Smith', content: 'Is this still available?', createdAt: new Date() }, { id: 'c_' + Math.random().toString(36).substr(2, 9), userId: 'user_seed_3', userName: 'David Park', userPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David%20Park', content: 'Would love to take this!', createdAt: new Date() }] },
        { title: "Vintage FujiFilm Camera & Film", description: "Upgraded, so giving away my X-T10. Hoping it finds a photography learner!", type: "SHARE", category: "Electronics", images: ["https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=1000"], status: "ACTIVE", reachTypes: ["VICINITY"], isFeatured: true, expiresAt: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 5), comments: [{ id: 'c_' + Math.random().toString(36).substr(2, 9), userId: 'user_seed_2', userName: 'Chloe Smith', userPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Chloe%20Smith', content: 'Is this still available?', createdAt: new Date() }, { id: 'c_' + Math.random().toString(36).substr(2, 9), userId: 'user_seed_3', userName: 'David Park', userPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David%20Park', content: 'Would love to take this!', createdAt: new Date() }] },
        { title: "Book Exchange: Sci-Fi & Fantasy", description: "Pile of sci-fi and fantasy books to swap. Bring what you've finished reading!", type: "SHARE", category: "Books", images: ["https://images.unsplash.com/photo-1510915361894-db8b60106cb1?q=80&w=1000"], status: "ACTIVE", reachTypes: ["VICINITY"], expiresAt: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 5), comments: [{ id: 'c_' + Math.random().toString(36).substr(2, 9), userId: 'user_seed_2', userName: 'Chloe Smith', userPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Chloe%20Smith', content: 'Is this still available?', createdAt: new Date() }, { id: 'c_' + Math.random().toString(36).substr(2, 9), userId: 'user_seed_3', userName: 'David Park', userPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David%20Park', content: 'Would love to take this!', createdAt: new Date() }] },
        { title: "Monstera cuttings ready for propagation", description: "They've been rooting in water. Ready for soil now. Bring a small pot.", type: "SHARE", category: "Plants", images: ["https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Monstera_deliciosa2.jpg/960px-Monstera_deliciosa2.jpg"], status: "ACTIVE", reachTypes: ["VICINITY"], expiresAt: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 5), comments: [{ id: 'c_' + Math.random().toString(36).substr(2, 9), userId: 'user_seed_2', userName: 'Chloe Smith', userPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Chloe%20Smith', content: 'Is this still available?', createdAt: new Date() }, { id: 'c_' + Math.random().toString(36).substr(2, 9), userId: 'user_seed_3', userName: 'David Park', userPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David%20Park', content: 'Would love to take this!', createdAt: new Date() }] },
        { title: "Giving away moving boxes", description: "Around 15 sturdy Banana boxes. Perfect for moving.", type: "SHARE", category: "Home", images: [], status: "ACTIVE", reachTypes: ["ALL_CIRCLES", "VICINITY"], expiresAt: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 5), comments: [{ id: 'c_' + Math.random().toString(36).substr(2, 9), userId: 'user_seed_2', userName: 'Chloe Smith', userPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Chloe%20Smith', content: 'Is this still available?', createdAt: new Date() }, { id: 'c_' + Math.random().toString(36).substr(2, 9), userId: 'user_seed_3', userName: 'David Park', userPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David%20Park', content: 'Would love to take this!', createdAt: new Date() }] },
        { title: "Home-grown tomatoes", description: "My balcony garden exploded. Giving away 2kg of cherry tomatoes.", type: "SHARE", category: "Food", images: [], status: "ACTIVE", reachTypes: ["VICINITY"], expiresAt: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 5), comments: [{ id: 'c_' + Math.random().toString(36).substr(2, 9), userId: 'user_seed_2', userName: 'Chloe Smith', userPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Chloe%20Smith', content: 'Is this still available?', createdAt: new Date() }, { id: 'c_' + Math.random().toString(36).substr(2, 9), userId: 'user_seed_3', userName: 'David Park', userPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David%20Park', content: 'Would love to take this!', createdAt: new Date() }] },

        // 4 IMECES
        { title: "Tempelhofer Feld Cleanup", description: "Full day cleanup of the grill area. Trash bags provided.", type: "IMECE", category: "Environment", images: ["https://upload.wikimedia.org/wikipedia/commons/2/2e/Community_garden_in_Ottawa.jpg"], status: "ACTIVE", reachTypes: ["VICINITY"], neededParticipants: 10, isFeatured: true, eventTime: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 3), eventEndTime: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 3 + 1000 * 60 * 60 * 2), comments: [{ id: 'c_' + Math.random().toString(36).substr(2, 9), userId: 'user_seed_4', userName: 'Emma Wagner', userPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma%20Wagner', content: 'Count me in.', createdAt: new Date() }] },
        { title: "Street Art Mural Painting at Mauerpark", description: "Need 15 volunteers to help block out colors. No experience needed!", type: "IMECE", category: "Art", images: ["https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Capitole_Toulouse_-_Salle_des_Illustres_-_Toulouse_coop%C3%A9rant_%C3%A0_la_d%C3%A9fense_nationale_1897_-_Jean-Andr%C3%A9_Rixens.jpg/960px-Capitole_Toulouse_-_Salle_des_Illustres_-_Toulouse_coop%C3%A9rant_%C3%A0_la_d%C3%A9fense_nationale_1897_-_Jean-Andr%C3%A9_Rixens.jpg"], status: "ACTIVE", reachTypes: ["VICINITY", "ALL_CIRCLES"], neededParticipants: 15, isFeatured: true, eventTime: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 3), eventEndTime: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 3 + 1000 * 60 * 60 * 2), comments: [{ id: 'c_' + Math.random().toString(36).substr(2, 9), userId: 'user_seed_4', userName: 'Emma Wagner', userPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma%20Wagner', content: 'Count me in.', createdAt: new Date() }] },
        { title: "Community Garden Spring Prep", description: "We need hands to turn soil and plant seeds for the local garden.", type: "IMECE", category: "Environment", images: [], status: "ACTIVE", reachTypes: ["VICINITY", "SPECIFIC_CIRCLES"], neededParticipants: 8, eventTime: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 3), eventEndTime: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 3 + 1000 * 60 * 60 * 2), comments: [{ id: 'c_' + Math.random().toString(36).substr(2, 9), userId: 'user_seed_4', userName: 'Emma Wagner', userPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma%20Wagner', content: 'Count me in.', createdAt: new Date() }] },
        { title: "Repair Cafe Pop-up Weekend", description: "Fixing electronics and bikes together. Bring your broken things or your tools.", type: "IMECE", category: "Community", images: [], status: "ACTIVE", reachTypes: ["ALL_CIRCLES"], neededParticipants: 5, eventTime: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 3), eventEndTime: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 3 + 1000 * 60 * 60 * 2), comments: [{ id: 'c_' + Math.random().toString(36).substr(2, 9), userId: 'user_seed_4', userName: 'Emma Wagner', userPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma%20Wagner', content: 'Count me in.', createdAt: new Date() }] },

        // 4 MISSIONS (Org Led)
        { title: "Winter clothing drive for local shelter", description: "Collect winter parkas for local shelters. Help sort or drive donations.", type: "MISSION", category: "Community", images: ["https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Schneewanne01.jpg/960px-Schneewanne01.jpg"], status: "ACTIVE", reachTypes: ["VICINITY", "ALL_CIRCLES"], neededParticipants: 20, isFeatured: true, orgOwner: "org_seed_kiez_helpers", eventTime: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 3), eventEndTime: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 3 + 1000 * 60 * 60 * 2), comments: [{ id: 'c_' + Math.random().toString(36).substr(2, 9), userId: 'user_seed_4', userName: 'Emma Wagner', userPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma%20Wagner', content: 'Count me in.', createdAt: new Date() }] },
        { title: "Food Rescue Drive", description: "Pick up food from 15 bakeries at closing time to redistribute.", type: "MISSION", category: "Community", images: [], status: "ACTIVE", reachTypes: ["ALL_CIRCLES"], neededParticipants: 10, orgOwner: "org_seed_food_saver", eventTime: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 3), eventEndTime: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 3 + 1000 * 60 * 60 * 2), comments: [{ id: 'c_' + Math.random().toString(36).substr(2, 9), userId: 'user_seed_4', userName: 'Emma Wagner', userPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma%20Wagner', content: 'Count me in.', createdAt: new Date() }] },
        { title: "Tree Planting Initiative 2026", description: "Help us plant 500 saplings in the outskirt forests this weekend.", type: "MISSION", category: "Environment", images: [], status: "ACTIVE", reachTypes: ["VICINITY"], neededParticipants: 50, orgOwner: "org_seed_green_earth", eventTime: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 3), eventEndTime: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 3 + 1000 * 60 * 60 * 2), comments: [{ id: 'c_' + Math.random().toString(36).substr(2, 9), userId: 'user_seed_4', userName: 'Emma Wagner', userPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma%20Wagner', content: 'Count me in.', createdAt: new Date() }] },
        { title: "Refugee Welcome Kits Assembly", description: "Assembling hygiene kits and welcome guides. Need 30 hands.", type: "MISSION", category: "Support", images: [], status: "ACTIVE", reachTypes: ["ALL_CIRCLES", "VICINITY"], neededParticipants: 30, orgOwner: "org_seed_community_builders", eventTime: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 3), eventEndTime: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 3 + 1000 * 60 * 60 * 2), comments: [{ id: 'c_' + Math.random().toString(36).substr(2, 9), userId: 'user_seed_4', userName: 'Emma Wagner', userPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma%20Wagner', content: 'Count me in.', createdAt: new Date() }] },
      ];

      const offset = 0.05; // ~5km spread around base location based on rough lat/lng approximation
      for (let i = 0; i < richMockData.length; i++) {
        const item = richMockData[i];
        
        let latOff = (Math.random() - 0.5) * offset;
        let lngOff = (Math.random() - 0.5) * offset;
        
        const itemLocation = { lat: loc.lat + latOff, lng: loc.lng + lngOff };

        let finalOwnerId, finalOwnerName, finalOwnerPhoto;
        let itemCircleId = null;

        if (item.type === 'MISSION') {
          const org = orgs.find(o => o.uid === item.orgOwner) || orgs[0];
          finalOwnerId = org.uid;
          finalOwnerName = org.displayName;
          finalOwnerPhoto = org.photoURL;
          itemCircleId = seedCircles[2].id; // Give it to Green Earth 
        } else {
          const user = seedUsers[i % seedUsers.length];
          finalOwnerId = user.uid;
          finalOwnerName = user.name;
          finalOwnerPhoto = \`https://api.dicebear.com/7.x/avataaars/svg?seed=\${encodeURIComponent(user.name)}\`;
          
          if (Math.random() > 0.5) {
            itemCircleId = seedCircles[i % seedCircles.length].id;
          }
        }

        const itemRef = db.collection('items').doc();
        createBatch.set(itemRef, {
          ...item,
          ownerId: finalOwnerId,
          ownerName: finalOwnerName,
          ownerPhoto: finalOwnerPhoto,
          targetCircles: itemCircleId ? [itemCircleId] : [],
          circleId: itemCircleId,
          location: itemLocation,
          createdAt: new Date(),
          participants: item.type === 'MISSION' || item.type === 'IMECE' ? [seedUsers[0].name, seedUsers[1].name] : [],
          isSeed: true
        });
      }

      await createBatch.commit();`;
  
  const modified = code.substring(0, startIdx) + newContent + code.substring(endIdx + endMarker.length);
  fs.writeFileSync('server.ts', modified);
  console.log("Success");
} else {
  console.error("Markers not found");
}
