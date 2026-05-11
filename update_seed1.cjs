const fs = require('fs');

const file = 'server.ts';
let code = fs.readFileSync(file, 'utf8');

const startMarker = 'const seedUsers = [';
const endMarker = 'const createBatch = db.batch();';

const startIdx = code.indexOf(startMarker);
const endIdx = code.indexOf(endMarker);

if (startIdx !== -1 && endIdx !== -1) {
  const newContent = `const seedUsers = [
        { uid: "user_seed_0", name: "Alice Chen", thePersonFor: ["Tech mentorship", "Baking"], lookoutFor: ["Language exchange", "Board games"], bio: "Software engineer who loves baking on weekends." },
        { uid: "user_seed_1", name: "Bob Miller", thePersonFor: ["Guitar lessons", "Dog walking"], lookoutFor: ["Plant cuttings", "Local gigs"], bio: "Musician and dog lover." },
        { uid: "user_seed_2", name: "Chloe Smith", thePersonFor: ["Yoga", "Vegan cooking"], lookoutFor: ["Hiking buddies", "Used books"], bio: "Yoga instructor, always looking for a new trail." },
        { uid: "user_seed_3", name: "David Park", thePersonFor: ["Math tutoring", "Moving help"], lookoutFor: ["Language exchange", "Photography"], bio: "Student and amateur photographer." },
        { uid: "user_seed_4", name: "Emma Wagner", thePersonFor: ["Graphic design", "Plant care"], lookoutFor: ["Tech help", "Art supplies"], bio: "Freelance designer creating community art." },
        { uid: "user_seed_5", name: "Felix Becker", thePersonFor: ["Bicycle repair", "Carpentry"], lookoutFor: ["Tool sharing", "Volunteering"], bio: "I fix things and build things." },
        { uid: "user_seed_6", name: "Greta Müller", thePersonFor: ["Event planning", "Local history"], lookoutFor: ["Venue spaces", "Community projects"], bio: "History buff and neighborhood organizer." },
        { uid: "user_seed_7", name: "Hassan Ali", thePersonFor: ["Language teaching", "Cooking"], lookoutFor: ["Sports partners", "Mentorship"], bio: "Chef and football enthusiast." },
        { uid: "user_seed_8", name: "Isabella Martinez", thePersonFor: ["Salsa dancing", "Spanish practice"], lookoutFor: ["Running partner", "Vegetarian recipes"], bio: "Expat from Madrid, loving the Berlin techno scene but missing good paella." },
        { uid: "user_seed_9", name: "Jonas Richter", thePersonFor: ["Tax help", "Excel spreadsheets"], lookoutFor: ["Coffee tasting", "Chess partners"], bio: "Accountant by day, coffee aficionado by night." },
        { uid: "user_seed_10", name: "Katarzyna Wójcik", thePersonFor: ["Knitting", "Cat sitting"], lookoutFor: ["Film photography", "Thrift shopping tips"], bio: "Vintage fashion lover and proud owner of three rescue cats." },
        { uid: "user_seed_11", name: "Liam O'Connor", thePersonFor: ["Bartending tricks", "Irish history"], lookoutFor: ["Music production", "Second-hand synths"], bio: "Pub manager and electronic music producer." },
        { uid: "user_seed_12", name: "Mia Johansen", thePersonFor: ["Interior design", "Minimalism"], lookoutFor: ["Pottery classes", "Indoor plants"], bio: "Scandinavian design enthusiast trying to make small apartments beautiful." },
        { uid: "user_seed_13", name: "Noah Okafor", thePersonFor: ["Web development", "Startup advice"], lookoutFor: ["Basketball pickup games", "Co-founders"], bio: "Tech entrepreneur building tools for social impact." },
        { uid: "user_seed_14", name: "Olivia Dubois", thePersonFor: ["French baking", "Cello performances"], lookoutFor: ["Acoustic jam sessions", "Book clubs"], bio: "Classically trained musician who loves a good croissant." },
        { uid: "user_seed_15", name: "Paul Schmidt", thePersonFor: ["Urban gardening", "Balcony farming"], lookoutFor: ["Compost worms", "Heirloom seeds"], bio: "Turning Berlin's concrete jungle green, one balcony at a time." }
      ];

      const orgs = [
        { uid: "org_seed_green_earth", displayName: "Green Earth NGO", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=GreenEarth", isOrganization: true, orgType: "CHARITY", bio: "Local environmental charity making our city greener.", thePersonFor: ["Environmental education", "Tree planting"], lookoutFor: ["Volunteers", "Donations"], isAdmin: false, createdAt: new Date() },
        { uid: "org_seed_community_builders", displayName: "Community Builders Berlin", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=CommunityBuilders", isOrganization: true, orgType: "SOCIAL_ENTERPRISE", bio: "Helping to strengthen neighborhoods.", thePersonFor: ["Neighborhood grants", "Workshops"], lookoutFor: ["Community leaders", "Project ideas"], isAdmin: false, createdAt: new Date() },
        { uid: "org_seed_kiez_helpers", displayName: "Kiez Helpers Neukölln", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=KiezHelpers", isOrganization: true, orgType: "CHARITY", bio: "Direct action for folks in need.", thePersonFor: ["Food distribution", "Clothing drives"], lookoutFor: ["Donations", "Drivers"], isAdmin: false, createdAt: new Date() },
        { uid: "org_seed_food_saver", displayName: "Food Saver Collective", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=FoodSaver", isOrganization: true, orgType: "SOCIAL_ENTERPRISE", bio: "Rescuing food from going to waste.", thePersonFor: ["Food rescue", "Cooking events"], lookoutFor: ["Partner restaurants", "Volunteers"], isAdmin: false, createdAt: new Date() },
        { uid: "org_seed_tech_refugees", displayName: "Tech for Refugees", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=TechRefugees", isOrganization: true, orgType: "CHARITY", bio: "Providing digital skills to newcomers.", thePersonFor: ["Coding bootcamps", "Laptop donations"], lookoutFor: ["Tech mentors", "Used laptops"], isAdmin: false, createdAt: new Date() },
        { uid: "org_seed_berlin_strays", displayName: "Berlin Stray Rescue", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=BerlinStrays", isOrganization: true, orgType: "CHARITY", bio: "Finding forever homes for local animals.", thePersonFor: ["Pet adoption", "Fostering"], lookoutFor: ["Foster homes", "Pet food donations"], isAdmin: false, createdAt: new Date() }
      ];

      `;
  
  const modified = code.substring(0, startIdx) + newContent + code.substring(endIdx);
  fs.writeFileSync(file, modified);
  console.log("Success phase 1");
} else {
  console.error("Markers not found");
}
