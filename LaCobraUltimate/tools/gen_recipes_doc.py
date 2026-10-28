"""Genera docs/RECETAS.md a partir de los JSON de recetas reales."""
import json, glob, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
lang = {}
for l in open(os.path.join(ROOT, "packs/LaCobra_RP/texts/es_ES.lang"), encoding="utf-8"):
    if "=" in l:
        k, v = l.strip().split("=", 1)
        lang[k] = re.sub("§.", "", v)
VANILLA = {"gold_ingot": "Lingote de oro", "ink_sac": "Saco de tinta", "amethyst_shard": "Fragmento de amatista",
           "leather": "Cuero", "diamond": "Diamante", "book": "Libro", "gold_nugget": "Pepita de oro",
           "fire_charge": "Carga ígnea", "spider_eye": "Ojo de araña", "crying_obsidian": "Obsidiana llorosa",
           "diamond_sword": "Espada de diamante", "blaze_rod": "Vara de blaze", "string": "Cuerda",
           "totem_of_undying": "Tótem de la inmortalidad", "gold_block": "Bloque de oro", "ender_eye": "Ojo de ender"}
def name(i):
    if i.startswith("lacobra:"):
        return lang.get("item.lacobra." + i.split(":")[1], i)
    return VANILLA.get(i.replace("minecraft:", ""), i)
order = ["escama_cobra", "nucleo_energia", "libro_tactico", "balon_dorado", "runa_instinto", "runa_remate", "runa_veneno",
         "runa_dominio", "guantes_goat", "totem_cobra", "espada_cobra", "casco_cobra", "pechera_cobra", "pantalones_cobra",
         "botas_cobra", "idolo_serpiente", "amuleto_cobra", "runa_suprema"]
tiers = {"escama_cobra": "1. Materiales básicos", "runa_instinto": "2. Primeras habilidades",
         "guantes_goat": "3. Equipo avanzado", "casco_cobra": "4. Armadura (requiere Núcleos)",
         "idolo_serpiente": "5. Jefe", "amuleto_cobra": "6. Objetos legendarios (botín del jefe)"}
out = ["# Recetas y progresión", "", "Generado automáticamente desde `packs/LaCobra_BP/recipes/` (`python3 tools/gen_recipes_doc.py`).",
       "Todas se fabrican en la **mesa de trabajo**. Los objetos de nivel 6 necesitan materiales que solo suelta La Serpiente Legendaria.", ""]
for n in order:
    if n in tiers:
        out += ["", "## " + tiers[n], ""]
    r = json.load(open(os.path.join(ROOT, f"packs/LaCobra_BP/recipes/{n}.json")))
    shaped = "minecraft:recipe_shaped" in r
    r = r.get("minecraft:recipe_shaped") or r.get("minecraft:recipe_shapeless")
    res = r["result"]
    out.append(f"### {name(res['item'])} x{res.get('count', 1)}")
    if shaped:
        out.append("```")
        for row in r["pattern"]:
            out.append(" ".join(f"[{c}]" if c != " " else "[ ]" for c in row.ljust(len(max(r['pattern'], key=len)))))
        out.append("```")
        for k, v in r["key"].items():
            out.append(f"- `{k}` = {name(v['item'])}")
    else:
        out.append("Sin forma: " + " + ".join(name(i["item"]) for i in r["ingredients"]))
    out.append("")
out += ["## Botín de La Serpiente Legendaria", "",
        "- 1 Esencia Suprema (siempre)", "- 2-3 Colmillos Legendarios", "- 2-4 Núcleos de Energía", "- 6-12 Escamas de Cobra",
        "- 1-3 bloques de oro", "- 35 % de probabilidad: Tótem de La Cobra", "- 600 de experiencia",
        "", "Las **Crías de Serpiente** (esbirros de la fase 2) sueltan una Escama de Cobra con un 50 % de probabilidad."]
open(os.path.join(ROOT, "docs/RECETAS.md"), "w", encoding="utf-8").write("\n".join(out) + "\n")
print("RECETAS.md generado")
