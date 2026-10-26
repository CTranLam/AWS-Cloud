import sys
from awsglue.context import GlueContext
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from pyspark.sql.functions import col, to_date

args = getResolvedOptions(sys.argv, ['SOURCE_PATH', 'DEST_PATH'])
sc = SparkContext()
gc = GlueContext(sc)

df = gc.spark_session.read.json(args['SOURCE_PATH'])

# Remove employees with dob before 1900-01-01
df = df.filter(to_date(col('dob'), 'yyyy-MM-dd') >= '1900-01-01')

df.write.mode("overwrite").json(args['DEST_PATH'])
