import { speciesDescriptions } from './speciesDescriptions'

export type NotableSpecies = {
  commonName: string
  scientificName?: string
  aliases?: string[]
  notability?: string
  description?: string
  whyNotable?: string[]
}

const notableSpeciesBase: NotableSpecies[] = [
  {
    commonName: 'Eisvogel',
    scientificName: 'Alcedo atthis',
    notability: 'Lokales Symbol',
    description:
      'Leuchtend blau-oranger Uferjaeger, der klare Gewaesser und steile Uferbaeume liebt.',
    whyNotable: ['Selten gut zu sehen', 'Starker Sympathietraeger'],
  },
  {
    commonName: 'Seeadler',
    scientificName: 'Haliaeetus albicilla',
    notability: 'Greifvogel',
    description:
      'Groesster Greifvogel Deutschlands, oft in Gewaessernaehe oder an Seen.',
    whyNotable: ['Imposante Spannweite', 'Beobachtung ist etwas Besonderes'],
  },
  {
    commonName: 'Wanderfalke',
    scientificName: 'Falco peregrinus',
    notability: 'Greifvogel',
    description: 'Schnellster Vogel im Sturzflug, jagt voellig ueberraschend.',
    whyNotable: ['Spektakulaere Jagd', 'Markante Stadtsiedler'],
  },
  {
    commonName: 'Rotmilan',
    scientificName: 'Milvus milvus',
    notability: 'Greifvogel',
    description: 'Greifvogel mit tief gegabeltem Schwanz, kreist oft ueber Feldern.',
    whyNotable: ['Deutschland ist Kerngebiet', 'Auffaelliges Flugbild'],
  },
  {
    commonName: 'Schwarzmilan',
    scientificName: 'Milvus migrans',
    notability: 'Greifvogel',
    description: 'Sommergast, haeufig in der Naehe von Fluessen und Seen.',
    whyNotable: ['Zieht im Sommer durch', 'Selten in staedtischer Naehe'],
  },
  {
    commonName: 'Fischadler',
    scientificName: 'Pandion haliaetus',
    notability: 'Greifvogel',
    description: 'Spezialisierter Fischjaeger, ruettelt ueber dem Wasser.',
    whyNotable: ['Seltene Sichtung', 'Charakteristische Jagd'],
  },
  {
    commonName: 'Habicht',
    scientificName: 'Accipiter gentilis',
    notability: 'Greifvogel',
    description: 'Kraeftiger Waldgreif, taucht oft unerwartet an Futterstellen auf.',
    whyNotable: ['Scheu und schnell', 'Selten im Freien zu sehen'],
  },
  {
    commonName: 'Sperber',
    scientificName: 'Accipiter nisus',
    notability: 'Greifvogel',
    description: 'Kleiner, flinker Greifvogel, jagt in Hecken und Gaerten.',
    whyNotable: ['Spannende Jagdszenen', 'Kontrast zu Singvoegeln'],
  },
  {
    commonName: 'Mäusebussard',
    scientificName: 'Buteo buteo',
    notability: 'Greifvogel',
    description: 'Hauefiger Greifvogel, aber als lokaler "Wappenvogel" sehr beliebt.',
    whyNotable: ['Bekannter Greifvogel', 'Gutes Zeichen fuer offene Landschaft'],
  },
  {
    commonName: 'Turmfalke',
    scientificName: 'Falco tinnunculus',
    notability: 'Greifvogel',
    description: 'Ruettelnd ueber Wiesen, oft an Strassenraendern zu sehen.',
    whyNotable: ['Klassischer Stadt- und Dorfgreif', 'Gut zu beobachten'],
  },
  {
    commonName: 'Kornweihe',
    scientificName: 'Circus cyaneus',
    notability: 'Greifvogel',
    description: 'Schlanker Greifvogel, der niedrig ueber Feldern und Heiden streift.',
    whyNotable: ['Winterlicher Gast', 'Eleganter Suchflug'],
  },
  {
    commonName: 'Rohrweihe',
    scientificName: 'Circus aeruginosus',
    notability: 'Greifvogel',
    description: 'Spezialist fuer Schilfguertel, kreist oft langsam ueber Feuchtgebieten.',
    whyNotable: ['Feuchtgebiets-Highlight', 'Gut an Brutplaetzen'],
  },
  {
    commonName: 'Wespenbussard',
    scientificName: 'Pernis apivorus',
    notability: 'Greifvogel',
    description: 'Scheuer Greifvogel, der vor allem Wespen und deren Brut frisst.',
    whyNotable: ['Sommerlicher Spezialist', 'Schwierig zu entdecken'],
  },
  {
    commonName: 'Baumfalke',
    scientificName: 'Falco subbuteo',
    notability: 'Greifvogel',
    description: 'Wendiger Kleinfalke, jagt Schwalben und Libellen im schnellen Flug.',
    whyNotable: ['Dynamische Jagd', 'Seltener Anblick'],
  },
  {
    commonName: 'Uhu',
    scientificName: 'Bubo bubo',
    notability: 'Eule',
    description: 'Groesste Eule Europas, meist nachtaktiv und sehr scheu.',
    whyNotable: ['Seltene Nachtsichtung', 'Beeindruckende Groesse'],
  },
  {
    commonName: 'Waldkauz',
    scientificName: 'Strix aluco',
    notability: 'Eule',
    description: 'Typische Wald- und Stadtparkeule, oft nur an Rufen erkennbar.',
    whyNotable: ['Markanter Ruf', 'Nahe am Menschen'],
  },
  {
    commonName: 'Schleiereule',
    scientificName: 'Tyto alba',
    notability: 'Eule',
    description: 'Helle Eule mit herzfoermigem Gesichtsschleier.',
    whyNotable: ['Sehr fotogen', 'Seltene Sichtung'],
  },
  {
    commonName: 'Waldohreule',
    scientificName: 'Asio otus',
    notability: 'Eule',
    description: 'Gut getarnte Eule mit markanten Federohren.',
    whyNotable: ['Winterliche Schlafbaeume', 'Unauffaellig und selten sichtbar'],
  },
  {
    commonName: 'Steinkauz',
    scientificName: 'Athene noctua',
    notability: 'Eule',
    description: 'Kleine Eule offener Landschaften, oft an Streuobstwiesen gebunden.',
    whyNotable: ['Kulturlandschafts-Spezialist', 'Lokale Raritaet'],
  },
  {
    commonName: 'Sumpfohreule',
    scientificName: 'Asio flammeus',
    notability: 'Eule',
    description: 'Tagaktive Eule, die niedrig ueber offenen Flaechen jagt.',
    whyNotable: ['Tagsueber aktiv', 'Selten und wanderfreudig'],
  },
  {
    commonName: 'Kranich',
    scientificName: 'Grus grus',
    notability: 'Zugzeit-Highlight',
    description: 'Zugvogel mit trompetenartigen Rufen, oft in Formationen.',
    whyNotable: ['Zugzeit-Spektakel', 'Starker Lokalklang'],
  },
  {
    commonName: 'Schwarzstorch',
    scientificName: 'Ciconia nigra',
    notability: 'Grossvogel',
    description: 'Scheuer Waldstorch, deutlich seltener als der Weissstorch.',
    whyNotable: ['Seltene Beobachtung', 'Wald- und Feuchtgebietsspezialist'],
  },
  {
    commonName: 'Weißstorch',
    scientificName: 'Ciconia ciconia',
    aliases: ['Weissstorch'],
    notability: 'Lokales Symbol',
    description: 'Bekannter Kulturbegleiter, nistet oft in Doerfern.',
    whyNotable: ['Stadt- und Dorfikon', 'Symbolart in Deutschland'],
  },
  {
    commonName: 'Silberreiher',
    scientificName: 'Ardea alba',
    notability: 'Wasservogel',
    description: 'Eleganter, grosser Reiher mit rein weissem Gefieder.',
    whyNotable: ['Auffaellige Erscheinung', 'Feuchtgebiets-Highlight'],
  },
  {
    commonName: 'Rohrdommel',
    scientificName: 'Botaurus stellaris',
    notability: 'Feuchtgebiets-Highlight',
    description: 'Meister der Tarnung im Schilf, oft nur durch tiefe Rufe verraten.',
    whyNotable: ['Extrem schwer zu sehen', 'Starker Indikator fuer gesunde Moore'],
  },
  {
    commonName: 'Löffler',
    scientificName: 'Platalea leucorodia',
    notability: 'Wasservogel',
    description: 'Auffaelliger Watvogel mit loeffelfoermigem Schnabel.',
    whyNotable: ['Unverwechselbares Aussehen', 'Selten im Inland'],
  },
  {
    commonName: 'Gänsesäger',
    scientificName: 'Mergus merganser',
    aliases: ['Gaensesaeger'],
    notability: 'Wasservogel',
    description: 'Grosser Saeger mit zottigem Schopf, jagt Fische in klaren Gewaessern.',
    whyNotable: ['Winterlicher Gast', 'Auffaelliger Kopfschmuck'],
  },
  {
    commonName: 'Zwergsäger',
    scientificName: 'Mergellus albellus',
    aliases: ['Zwergsaeger'],
    notability: 'Wasservogel',
    description: 'Kleiner Saeger mit kontrastreichem Gefieder, haeufig in kalten Monaten.',
    whyNotable: ['Selten und attraktiv', 'Winterliches Highlight'],
  },
  {
    commonName: 'Wiedehopf',
    scientificName: 'Upupa epops',
    notability: 'Ikonische Art',
    description: 'Auffaelliges Federkleid mit Haube, ruft "hup-hup".',
    whyNotable: ['Sehr fotogen', 'Saisonale Besonderheit'],
  },
  {
    commonName: 'Bienenfresser',
    scientificName: 'Merops apiaster',
    notability: 'Farbenpracht',
    description: 'Extrem farbenfroher Insektenjaeger, oft kolonial bruetend.',
    whyNotable: ['Farbenpracht', 'Nur lokal zu finden'],
  },
  {
    commonName: 'Pirol',
    scientificName: 'Oriolus oriolus',
    notability: 'Farbenpracht',
    description: 'Gelb-schwarzer Waldsaenger, haeufig nur am Ruf erkennbar.',
    whyNotable: ['Selten sichtbar', 'Unverwechselbarer Ruf'],
  },
  {
    commonName: 'Schwarzspecht',
    scientificName: 'Dryocopus martius',
    notability: 'Specht',
    description: 'Groesster Specht Europas, haeufig in grossen Waeldern.',
    whyNotable: ['Starker Ruf', 'Praegt den Waldklang'],
  },
  {
    commonName: 'Mittelspecht',
    scientificName: 'Dendrocopos medius',
    notability: 'Specht',
    description: 'Spezialisiert auf alte Laubwaelder und strukturreiche Bestaende.',
    whyNotable: ['Anspruchsvoller Lebensraum', 'Relativ selten'],
  },
  {
    commonName: 'Grauspecht',
    scientificName: 'Picus canus',
    notability: 'Specht',
    description: 'Gruenlich-grauer Specht, oft in ruhigen Waldgebieten.',
    whyNotable: ['Unauffaellige Art', 'Selten im Siedlungsraum'],
  },
  {
    commonName: 'Grünspecht',
    scientificName: 'Picus viridis',
    aliases: ['Gruenspecht'],
    notability: 'Specht',
    description: 'Wiesen- und Waldrandspecht, oft am Boden bei Ameisennahrung.',
    whyNotable: ['Lauter Lachtausruf', 'Gut in offenen Flaechen'],
  },
  {
    commonName: 'Dreizehenspecht',
    scientificName: 'Picoides tridactylus',
    notability: 'Specht',
    description: 'Seltene Spechtart in alten Nadelwaeldern und Hochlagen.',
    whyNotable: ['Sehr selten', 'Zeiger fuer naturnahe Waelder'],
  },
  {
    commonName: 'Wendehals',
    scientificName: 'Jynx torquilla',
    notability: 'Specht',
    description: 'Spechtverwandter mit wellenfoermigem Flug und auffaelligem Ruf.',
    whyNotable: ['Seltene Brutart', 'Ungewoehnliche Verhaltensweise'],
  },
  {
    commonName: 'Raubwürger',
    scientificName: 'Lanius excubitor',
    notability: 'Wuerger',
    description: 'Grauer Wuerger, beobachtet von erhoehten Ansitzen.',
    whyNotable: ['Raubvogel-Attituede im Singvogelkoerper', 'Winterlicher Spezialist'],
  },
  {
    commonName: 'Neuntöter',
    scientificName: 'Lanius collurio',
    notability: 'Wuerger',
    description: 'Sommerlicher Wuerger, bekannt fuer Vorratshaltung.',
    whyNotable: ['Verhaltens-Highlight', 'Brutzeitliche Seltenheit'],
  },
  {
    commonName: 'Bergfink',
    scientificName: 'Fringilla montifringilla',
    notability: 'Zugzeit-Highlight',
    description: 'Zugfink, der in grossen Schwaermen auftreten kann.',
    whyNotable: ['Massenaufkommen moeglich', 'Saisonale Besonderheit'],
  },
  {
    commonName: 'Seidenschwanz',
    scientificName: 'Bombycilla garrulus',
    notability: 'Irruptionsart',
    description: 'Eleganter Wintergast mit auffaelligen roten Fluegelspitzen.',
    whyNotable: ['Irruptionsart', 'Sehr fotogen'],
  },
  {
    commonName: 'Kernbeißer',
    scientificName: 'Coccothraustes coccothraustes',
    notability: 'Auffaelliger Fink',
    description: 'Kraeftiger Fink mit massivem Schnabel, knackt harte Kerne.',
    whyNotable: ['Beeindruckender Schnabel', 'Selten lang zu beobachten'],
  },
]

const normalize = (value?: string) => (value ?? '').trim().toLowerCase()

const descriptionByScientificName = new Map(
  speciesDescriptions.map((entry) => [normalize(entry.scientificName), entry.description]),
)

export const notableSpecies: NotableSpecies[] = notableSpeciesBase.map((entry) => {
  if (entry.description) {
    return entry
  }

  const scientificKey = normalize(entry.scientificName)
  const fallbackDescription = descriptionByScientificName.get(scientificKey)

  if (!fallbackDescription) {
    return entry
  }

  return {
    ...entry,
    description: fallbackDescription,
  }
})
