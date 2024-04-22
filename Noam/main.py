import pandas
import json

def main():
    book = pandas.read_excel("רשימת_מילים.xlsx")
    d = book.to_dict('records')
    with open("words.json", "w") as outfile: 
        json.dump(d, outfile)
if __name__ == "__main__":
    main()

