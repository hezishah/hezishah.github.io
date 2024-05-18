import pandas
import json

def main():
    book = pandas.read_excel("words_v3.xlsx")
    d = book.to_dict('records')
    with open("words_v2.json", "w") as outfile: 
        json.dump(d, outfile)
if __name__ == "__main__":
    main()

