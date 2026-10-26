import sys
from awsglue.context import GlueContext
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext

args = getResolvedOptions(sys.argv, ['SOURCE_PATH', 'DEST_PATH'])
sc = SparkContext()
gc = GlueContext(sc)

df = gc.spark_session.read.json(args['SOURCE_PATH'])
df.write.mode("overwrite").parquet(args['DEST_PATH'])
